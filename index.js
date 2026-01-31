import Anthropic from '@anthropic-ai/sdk';
import { Resend } from 'resend';

// Configuration
const CONFIG = {
  // Trending filters
  language: '', // e.g., 'python', 'javascript', 'typescript'. Empty for all languages
  since: 'daily', // 'daily', 'weekly', 'monthly'
  spokenLanguage: '', // e.g., 'en', 'zh'. Empty for all

  // Email settings
  recipientEmail: process.env.RECIPIENT_EMAIL,
  fromEmail: process.env.FROM_EMAIL || 'noreply@yourdomain.com',

  // API Keys
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  anthropicBaseUrl: process.env.ANTHROPIC_BASE_URL || 'https://open.bigmodel.cn/api/anthropic',
  model: process.env.MODEL || 'glm-4.7',
  resendApiKey: process.env.RESEND_API_KEY,
};

/**
 * Fetch GitHub Trending repositories
 */
async function fetchGithubTrending() {
  const url = new URL('https://github.com/trending');

  if (CONFIG.language) {
    url.pathname += `/${CONFIG.language}`;
  }

  url.searchParams.set('since', CONFIG.since);

  if (CONFIG.spokenLanguage) {
    url.searchParams.set('spoken_language_code', CONFIG.spokenLanguage);
  }

  console.log(`Fetching GitHub Trending from: ${url.toString()}`);

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const html = await response.text();
    return parseTrendingHTML(html);
  } catch (error) {
    console.error('Error fetching GitHub Trending:', error);
    throw error;
  }
}

/**
 * Parse GitHub Trending HTML to extract repo data
 */
function parseTrendingHTML(html) {
  const repos = [];

  // Extract article elements containing repo info
  const articleRegex = /<article[^>]*class="[^"]*Box-row[^"]*"[^>]*>([\s\S]*?)<\/article>/g;
  let match;

  while ((match = articleRegex.exec(html)) !== null) {
    const articleContent = match[1];

    // Extract owner and repo name
    const repoLinkMatch = /href="\/([^\/]+)\/([^\/]+)"/.exec(articleContent);
    if (!repoLinkMatch) continue;

    const owner = repoLinkMatch[1];
    const repoName = repoLinkMatch[2];

    // Extract description
    const descMatch = /<p[^>]*class="[^"]*col-9[^"]*"[^>]*>([\s\S]*?)<\/p>/.exec(articleContent);
    const description = descMatch ? descMatch[1].replace(/<[^>]*>/g, '').trim() : '';

    // Extract programming language
    const langMatch = /<span[^>]*itemprop="programmingLanguage"[^>]*>([^<]+)<\/span>/.exec(articleContent);
    const language = langMatch ? langMatch[1].trim() : '';

    // Extract stars
    const starsMatch = /<a[^>]*href="\/[^\/]+\/[^\/]+\/stargazers"[^>]*>([\s\S]*?)<\/a>/.exec(articleContent);
    let stars = starsMatch ? starsMatch[1].replace(/<[^>]*>/g, '').replace(/[\s,]/g, '').trim() : '0';
    stars = stars.replace(/k$/i, '000');

    // Extract forks
    const forksMatch = /<a[^>]*href="\/[^\/]+\/[^\/]+\/forks"[^>]*>([\s\S]*?)<\/a>/.exec(articleContent);
    let forks = forksMatch ? forksMatch[1].replace(/<[^>]*>/g, '').replace(/[\s,]/g, '').trim() : '0';
    forks = forks.replace(/k$/i, '000');

    // Extract stars today
    const starsTodayMatch = /<span[^>]*class="[^"]*d-inline-block[^"]*"[^>]*>([\s\S]*?)stars today<\/span>/.exec(articleContent);
    let starsToday = starsTodayMatch ? starsTodayMatch[1].replace(/<[^>]*>/g, '').replace(/[\s,]/g, '').trim() : '0';
    starsToday = starsTodayMatch?.[1]?.includes('k') ? (parseFloat(starsTodayMatch[1].replace(/[^\d.]/g, '')) * 1000).toString() : starsToday;

    repos.push({
      owner,
      repoName,
      fullName: `${owner}/${repoName}`,
      description,
      language,
      stars: parseInt(stars) || 0,
      forks: parseInt(forks) || 0,
      starsToday: starsToday || 'N/A',
      url: `https://github.com/${owner}/${repoName}`,
    });
  }

  return repos;
}

/**
 * Generate summary using Claude API
 */
async function generateSummary(repos) {
  const anthropic = new Anthropic({
    apiKey: CONFIG.anthropicApiKey,
    baseURL: CONFIG.anthropicBaseUrl,
  });

  const trendingText = repos.map((repo, index) => {
    return `${index + 1}. ${repo.fullName}
   语言: ${repo.language || 'N/A'}
   Stars: ${repo.stars.toLocaleString()} (+${repo.starsToday} today)
   描述: ${repo.description || '无描述'}
   链接: ${repo.url}`;
  }).join('\n\n');

  console.log('Generating summary with Claude...');

  const message = await anthropic.messages.create({
    model: CONFIG.model,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `请将以下 GitHub Trending 项目整理成一份简洁、易读的每日总结邮件。

要求：
1. 按类别/主题将项目分组
2. 对每个项目添加简短的中文点评（1-2句话）
3. 突出显示最值得关注的几个项目
4. 使用 HTML 格式，便于邮件展示
5. 风格要简洁、专业
6. 包含今天的日期

项目列表：
${trendingText}

请直接返回 HTML 内容，不要添加任何额外的解释文字。`,
      },
    ],
  });

  return message.content[0].text;
}

/**
 * Format summary as HTML email
 */
function formatAsEmail(summary) {
  const today = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  // If Claude already returned HTML, wrap it properly
  // Otherwise, convert markdown to HTML
  let htmlContent = summary;

  // Basic markdown to HTML conversion if needed
  if (!htmlContent.includes('<html') && !htmlContent.includes('<div')) {
    htmlContent = htmlContent
      .replace(/### (.*)/g, '<h3>$1</h3>')
      .replace(/## (.*)/g, '<h2>$1</h2>')
      .replace(/# (.*)/g, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f9f9f9;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 {
      color: #0366d6;
      border-bottom: 2px solid #0366d6;
      padding-bottom: 10px;
    }
    h2 {
      color: #24292e;
      margin-top: 25px;
    }
    h3 {
      color: #586069;
    }
    a {
      color: #0366d6;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    .highlight {
      background-color: #fff8c5;
      padding: 15px;
      border-left: 4px solid #ffd33d;
      margin: 20px 0;
    }
    .repo-card {
      background-color: #f6f8fa;
      border: 1px solid #e1e4e8;
      border-radius: 6px;
      padding: 15px;
      margin: 10px 0;
    }
    .footer {
      text-align: center;
      color: #586069;
      font-size: 12px;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e1e4e8;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>GitHub Trending 每日总结</h1>
    <p><strong>${today}</strong></p>
    ${htmlContent}
    <div class="footer">
      <p>本邮件由 GitHub Trending Daily 自动生成</p>
      <p>如需退订，请回复此邮件</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Send email using Resend
 */
async function sendEmail(htmlContent) {
  const resend = new Resend(CONFIG.resendApiKey);

  const today = new Date().toLocaleDateString('zh-CN');

  console.log(`Sending email to ${CONFIG.recipientEmail}...`);

  const result = await resend.emails.send({
    from: CONFIG.fromEmail,
    to: CONFIG.recipientEmail,
    subject: `GitHub Trending 每日总结 - ${today}`,
    html: htmlContent,
  });

  console.log('Email sent successfully:', result);
  return result;
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('=== GitHub Trending Daily Summary ===');
    console.log(`Started at: ${new Date().toISOString()}`);

    // Step 1: Fetch trending
    console.log('\n[1/3] Fetching GitHub Trending...');
    const repos = await fetchGithubTrending();
    console.log(`Found ${repos.length} trending repositories`);

    if (repos.length === 0) {
      console.warn('No repositories found. Exiting.');
      return;
    }

    // Step 2: Generate summary
    console.log('\n[2/3] Generating summary...');
    const summary = await generateSummary(repos);

    // Step 3: Send email
    console.log('\n[3/3] Sending email...');
    const emailHtml = formatAsEmail(summary);
    await sendEmail(emailHtml);

    console.log('\n=== Completed successfully ===');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main, fetchGithubTrending, generateSummary, sendEmail };
