const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());

app.post('/crawl', async (req, res) => {
  const { url, maxPages = 5 } = req.body;
  if (!url) return res.status(400).json({ error: 'Debes enviar una URL en el body.' });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const products = [];
  let currentPage = 1;

  try {
    await page.goto(url, { waitUntil: 'networkidle2' });

    while (currentPage <= maxPages) {
      await autoScroll(page);

      // Extraer productos
      const pageProducts = await page.$$eval('.styled--productcard-container', items =>
        items.map(item => {
          const title = item.querySelector('.product-name')?.textContent.trim() || '';
          const brand = item.querySelector('.product-brand')?.textContent.trim() || '';
          const productUrl = item.querySelector('.styled--link-container')?.href || '';
          const imageUrl = item.querySelector('.product-card-image img')?.src || '';
          const price = item.querySelector('.product-price')?.textContent.trim() || '';
          return { title, brand, productUrl, imageUrl, price };
        })
      );

      products.push(...pageProducts);

      // Verificar si existe botón "Siguiente"
      const nextButtonExists = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(btn => btn.innerText.includes('Siguiente')) !== undefined;
      });

      if (nextButtonExists) {
        await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const nextBtn = buttons.find(btn => btn.innerText.includes('Siguiente'));
          if (nextBtn) nextBtn.click();
        });

        // Esperar 3 segundos para que cargue la siguiente página
        await new Promise(resolve => setTimeout(resolve, 3000));

        currentPage++;
      } else {
        break;
      }
    }

    await browser.close();
    res.json({
      totalProducts: products.length,
      pagesVisited: currentPage,
      products
    });
  } catch (error) {
    await browser.close();
    res.status(500).json({ error: error.message });
  }
});

// Scroll infinito
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let totalHeight = 0;
      const distance = 500;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 500);
    });
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API lista en http://localhost:${PORT}`));