import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // Collect all console messages
  const consoleErrors = [];
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleErrors.push({ type: msg.type(), text });
    }
  });

  // Collect page errors (unhandled exceptions)
  const pageErrors = [];
  page.on('pageerror', err => {
    pageErrors.push(err.message);
  });

  try {
    // Step 1: Navigate to login
    console.log('1. Navigating to login...');
    await page.goto(`${BASE}/login`, { waitUntil: 'load', timeout: 45000 });
    await sleep(3000);
    
    // Debug: take screenshot and check page content
    await page.screenshot({ path: 'login-page.png' });
    console.log('   Login page screenshot saved');
    
    const pageTitle = await page.title();
    console.log('   Page title:', pageTitle);
    
    const bodyText = await page.textContent('body');
    console.log('   Body text (first 500 chars):', bodyText.trim().substring(0, 500));

    // Step 2: Login - try multiple selectors
    console.log('2. Logging in...');
    
    // Try email field with various selectors
    const emailField = await page.$('input[type="email"]') || 
                       await page.$('input[name="email"]') ||
                       await page.$('input[placeholder*="email" i]') ||
                       await page.$('input[placeholder*="mail" i]');
    
    const passField = await page.$('input[type="password"]') ||
                      await page.$('input[name="password"]') ||
                      await page.$('input[placeholder*="password" i]');
    
    if (emailField && passField) {
      await emailField.fill('testuser@test.com');
      await passField.fill('testpass123');
      
      const submitBtn = await page.$('button[type="submit"]') ||
                        await page.$('button:has-text("Sign In")') ||
                        await page.$('button:has-text("Login")') ||
                        await page.$('button:has-text("Log in")') ||
                        await page.$('form button');
      
      if (submitBtn) {
        await submitBtn.click();
        console.log('   Login form submitted');
      } else {
        console.log('   No submit button found');
        // Try pressing Enter in password field
        await passField.press('Enter');
        console.log('   Pressed Enter on password field');
      }
    } else {
      console.log('   Could not find login fields. Email:', !!emailField, 'Password:', !!passField);
      // List all input fields
      const inputs = await page.$$('input');
      for (const input of inputs) {
        const type = await input.getAttribute('type');
        const name = await input.getAttribute('name');
        const placeholder = await input.getAttribute('placeholder');
        console.log(`   Input: type=${type} name=${name} placeholder=${placeholder}`);
      }
    }
    
    // Wait for navigation to dashboard
    try {
      await page.waitForURL('**/dashboard', { timeout: 15000 });
      console.log('   Navigated to dashboard');
    } catch (e) {
      console.log('   Navigation to dashboard timed out, current URL:', page.url());
      await page.screenshot({ path: 'after-login.png' });
    }
    await sleep(2000);
    console.log('   Current URL:', page.url());

    // Step 3: Check for any console errors on the empty dashboard
    console.log(`   Console errors so far: ${consoleErrors.length}`);
    consoleErrors.forEach(e => console.log(`   [${e.type}] ${e.text}`));

    // Step 4: Click "Sales Analytics" quick start to generate a dashboard
    console.log('3. Clicking "Sales Analytics" quick start...');
    const quickStartBtns = await page.locator('text=Sales Analytics').all();
    if (quickStartBtns.length > 0) {
      await quickStartBtns[0].click();
      console.log('   Quick start clicked, waiting for dashboard generation...');
      
      // Wait for the dashboard widgets to appear (up to 30 seconds for AI)
      await sleep(15000);
      
      // Check for widgets
      const widgets = await page.locator('[id="dashboard-widget-grid"] > div').count();
      console.log(`   Widgets rendered: ${widgets}`);
      
      // Wait a bit more for Recharts to fully render
      await sleep(5000);
    } else {
      console.log('   No quick start button found, trying chat input...');
      // Try typing in the chat
      const input = await page.locator('input[placeholder*="Ask AI"]').first();
      if (await input.isVisible()) {
        await input.fill('Show me sales performance');
        await page.locator('button[type="submit"]').first().click();
        console.log('   Prompt sent, waiting...');
        await sleep(20000);
      }
    }

    // Step 5: Final console check
    console.log('\n=== CONSOLE ERROR REPORT ===');
    console.log(`Total console errors/warnings: ${consoleErrors.length}`);
    
    const rechartsErrors = consoleErrors.filter(e => 
      e.text.includes('width') && e.text.includes('height') && 
      (e.text.includes('-1') || e.text.includes('greater than 0'))
    );
    console.log(`Recharts width/height errors: ${rechartsErrors.length}`);
    
    const reactErrors = consoleErrors.filter(e => 
      e.text.includes('key') || e.text.includes('Each child')
    );
    console.log(`React key errors: ${reactErrors.length}`);

    console.log('\nAll console messages:');
    consoleErrors.forEach((e, i) => console.log(`  ${i+1}. [${e.type}] ${e.text}`));

    console.log('\nPage errors:');
    pageErrors.forEach((e, i) => console.log(`  ${i+1}. ${e}`));

    // Take a screenshot
    await page.screenshot({ path: 'dashboard-test.png', fullPage: true });
    console.log('\nScreenshot saved to dashboard-test.png');

    if (rechartsErrors.length === 0 && reactErrors.length === 0) {
      console.log('\n✅ PASS: No Recharts or React key errors found!');
    } else {
      console.log(`\n❌ FAILED: Found ${rechartsErrors.length} Recharts errors and ${reactErrors.length} React key errors`);
    }

  } catch (err) {
    console.error('Test error:', err.message);
    await page.screenshot({ path: 'dashboard-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

main();
