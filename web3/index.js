const PORT = 8003;
const express = require('express');
const app = express();
const puppeteer = require('puppeteer')
const xlsx = require('xlsx');

//const url="https://www.goodreads.com/book/show/2.Harry_Potter_and_the_Order_of_the_Phoenix"
const excelFilePath = 'C:/Users/lenovo/Downloads/goodreads.xlsx';
const workbook = xlsx.readFile(excelFilePath);
const firstSheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[firstSheetName];
// B sütunu verilerini al 2.satırdan itibaren
const urlList = [];
for (let rowIndex = 2; ; rowIndex++) {
    const cellAddress = 'B' + rowIndex;
    const cell = worksheet[cellAddress];
    if (!cell || !cell.v) {
        // Eğer hücre boşsa veya değeri yoksa döngüyü sonlandır
        break;
    }
    urlList.push(cell.v);
}
const delayBetweenRequests = 100; // 2 saniye

const promises = urlList.slice(0, 50).map((url, index) => {
    return async () => {
        await fetchData(url);
        console.log(`URL ${index + 1} işlendi: ${url}`);
        return true;
    };
});

// Ardışık olarak işlem yapmak için reduce fonksiyonunu kullanır
promises.reduce(async (previousPromise, nextPromise) => {
    await previousPromise;
    await new Promise(resolve => setTimeout(resolve, delayBetweenRequests)); // Bekleme süresi
    return nextPromise();
}, Promise.resolve());

async function fetchData(url) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    try {
        await page.goto(url, { waitUntil: 'networkidle2' , timeout: 120000});
        await page.waitForSelector('.ReviewsList__listContext');
        // Sayfadaki incelemeleri çek
        const reviews = await page.evaluate(() => {
            const reviewsList = [];
            const reviewCards = document.querySelectorAll('.ReviewCard');
            const maxCards = Math.min(5, reviewCards.length); // İlk 5 elemanı al veya mevcut eleman sayısına kadar al

            for (let i = 0; i < maxCards; i++) {
                const card = reviewCards[i];
                const nameElement = card.querySelector('.ReviewerProfile__name a');
                const commentElement = card.querySelector('.ReviewCard__content .Formatted');
            
                const name = nameElement ? nameElement.innerText.trim() : '';
                const comment = commentElement ? commentElement.innerText.trim() : '';
                
                const reviewObj = {
                    name: name,
                    comment: comment,
                };
            
                reviewsList.push(reviewObj);
            }
            return reviewsList;
        });

        console.log(reviews);
    } catch (error) {
        console.error('Hata:', error);
    } finally {
        await browser.close();
    }
}



app.listen(PORT, () => console.log(`Port ${PORT} dinleniyor.`));
