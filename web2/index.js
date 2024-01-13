const PORT = 8002;
const express = require('express');
const app = express();
const puppeteer = require('puppeteer')
const xlsx = require('xlsx');
const dbConfig = require('./dbconfig');



//const url="https://www.goodreads.com/book/show/2.Harry_Potter_and_the_Order_of_the_Phoenix"
const excelFilePath = 'C:/Users/lenovo/Downloads/10k.xlsx';
const workbook = xlsx.readFile(excelFilePath);
const firstSheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[firstSheetName];
// B sütunu verilerini al 2.satırdan itibaren
const urlList = [];
const booknameList=[];
for (let rowIndex = 2; ; rowIndex++) {
    const UrlcellAddress = 'B' + rowIndex;
    const cellUrl = worksheet[UrlcellAddress];
    
    const NamecellAddress='D'+rowIndex
    const cellName = worksheet[NamecellAddress];

    if (!cellUrl || !cellUrl.v) { break;  }
    if (!cellName || !cellName.v) {  break; }
    urlList.push(cellUrl.v);
    booknameList.push(cellName.v)
}
const delayBetweenRequests = 100; // 2 saniye

const promises = urlList.slice(0,50).map((url, index) => {
     var bookname=   booknameList[index]
    return async () => {
        await fetchData(url,bookname);
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

async function fetchData(url,bookname) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
   
    
    try {
        await page.goto(url, { waitUntil: 'networkidle2' , timeout: 120000});
        await page.waitForSelector('.ReviewsList__listContext');
        // Sayfadaki incelemeleri çek
        const reviews = await page.evaluate((booknames) => {
            const reviewsList = [];
            const reviewCards = document.querySelectorAll('.ReviewCard');
            const maxCards =  reviewCards.length; // İlk 5 elemanı al veya mevcut eleman sayısına kadar al

            for (let i = 0; i < maxCards; i++) {
                const card = reviewCards[i];
                const nameElement = card.querySelector('.ReviewerProfile__name a');
               
                const commentElement = card.querySelector('.ReviewCard__content .Formatted');
                const ratingElement = card.querySelector('.RatingStars[aria-label]'); // Rating elementini seç
                const ratingValue =ratingElement?  ratingElement.getAttribute('aria-label').charAt(7):''; // Rating değerini al
                
                
                
                const name = nameElement ? nameElement.innerText.trim() : '';
                const comment = commentElement ? commentElement.innerText.trim() : '';
                
                const reviewObj = {
                    username: name,
                    bookname:booknames,
                    rate:ratingValue,
                    comment: comment,
                };
            
                reviewsList.push(reviewObj);
            }
            return reviewsList;
        },bookname);
        await saveReviewsToDatabase(reviews);
    } catch (error) {
        console.error('Hata:', error);
    } finally {
        await browser.close();
    }
}
async function saveReviewsToDatabase(reviews) {
    for (const review of reviews) {
      let comment = "";
      try {
        comment = String(review.comment).replaceAll("'", "\\'");
      } catch (error) {
        console.error(`Error while escaping comment for review: ${review.username} - ${review.bookname}`, error);
      }
  
      const query = `
        INSERT INTO Userratings (username, bookname, rating, comments) 
        VALUES ('${String(review.username)}', '${String(review.bookname)}', ${review.rate}, '${comment}');
      `;
  
      try {
        await dbConfig.promise().execute(query);
      } catch (error) {
        console.error('MySQL insert error:', error);
      }
    }
  
    console.log('Reviews successfully saved to the database.');
  }
app.listen(PORT, () => console.log(`Port ${PORT} dinleniyor.`));
