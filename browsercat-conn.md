import * as pw from 'playwright';

const bcatUrl = 'wss://api.browsercat.com/connect';

async function run() {
  // Create a new browser instance
  const browser = await pw.chromium.connect(bcatUrl, {
    headers: {'Api-Key': '<YOUR_API_KEY>'},
  });

  // Do stuff...
  const page = await browser.newPage();
  await page.goto('https://example.com');
  console.log(await page.title());

  // Close the browser when you're done
  await browser.close();
}

run();
