const PORT = 8003;
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
const booknameList = [];
for (let rowIndex = 2; ; rowIndex++) {
    const UrlcellAddress = 'B' + rowIndex;
    const cellUrl = worksheet[UrlcellAddress];

    const NamecellAddress = 'D' + rowIndex
    const cellName = worksheet[NamecellAddress];

    if (!cellUrl || !cellUrl.v) { break; }
    if (!cellName || !cellName.v) { break; }
    urlList.push(cellUrl.v);
    booknameList.push(cellName.v)
}
const delayBetweenRequests = 100; // 2 saniye
// const missList=[17,20,22,30,32,34,36,43,44,59,80,82,91,92,95,105,109,122,134,157,161,163,164,167,176,179,180,187,189,194]
const promises = urlList.slice(300,400).map((url, index) => {
    var bookname = booknameList[index+300]
    return async () => {
        await fetchData(url, bookname);
        console.log(`URL ${index + 1} işlendi: ${url}`);
        return true;
    };
});
const promises2 = missList.map((urlindex) => {
    var bookname = booknameList[urlindex-1]
    return async () => {
        await fetchData(urlList[urlindex-1], bookname);
        console.log(`URL ${urlindex -1 } işlendi: ${urlList[urlindex-1]}`);
        return true;
    };
});



/*const promises = urlList.slice(200, 210).map((url, index) => {
    var bookname = booknameList[index+200] */


// Ardışık olarak işlem yapmak için reduce fonksiyonunu kullanır
promises.reduce(async (previousPromise, nextPromise) => {
    await previousPromise;
    await new Promise(resolve => setTimeout(resolve, delayBetweenRequests)); // Bekleme süresi
    return nextPromise();
}, Promise.resolve());


async function fetchData(url, bookname) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });

        const aTag = await page.waitForSelector('div.Divider--contents a.Button', {
            timeout: 120000,
        });
        const hrefAttribute = await aTag.evaluate(tag => tag.getAttribute('href'));

        const url2 = "https://www.goodreads.com" + hrefAttribute
        if (url2 != null) {
            await page.close();
            console.log("kapattı")
            console.log(url2)
            await  fetchData2(url2,bookname)    
           }
        else{
            console.log("url2 ye girmedi")
        }
        // Sayfadaki incelemeleri çek

    } catch (error) {
        console.error('Hata:', error);
    } finally {
        await browser.close();
    }
}
async function fetchData2(url, bookname) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    try {

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
        await page.waitForSelector('.ReviewsList__listContext',{ timeout: 120000 });
        await page.waitForSelector('.Divider--contents',{ timeout: 120000 });
        console.log("divider buldu")
        await page.click('.Divider--contents button');
        console.log("Şeçili buttona tıklandı")
        await new Promise(r => setTimeout(r, 2000));
        console.log("2000 ms beklendi")
        await page.waitForSelector('.ReviewsList__listContext', { timeout: 120000 });

        const reviews = await page.evaluate( async(booknames) => {
            
            const reviewsList = [];

            const reviewCards = document.querySelectorAll('.ReviewCard');
            const maxCards =  reviewCards.length; // İlk 5 elemanı al veya mevcut eleman sayısına kadar al
             
            for (let i = 0; i < maxCards; i++) {
                const card = reviewCards[i];
                const nameElement = card.querySelector('.ReviewerProfile__name a');
               
                const commentElement = card.querySelector('.ReviewCard__content .Formatted');
                const ratingElement = card.querySelector('.RatingStars[aria-label]'); // Rating elementini seç
                const ratingValue = ratingElement? ratingElement.getAttribute('aria-label').match(/\d+/)[0] : '-1';                
                
                
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
        let username =" ";
        let book =" ";
        let comment = " "; 
          try {
            username = String(review.username.replaceAll("'", " "));
            book = String(review.bookname.replaceAll("'", " "));
            comment = String(review.comment.replaceAll("'", " "));
            comment = "\"" + comment + "\"";
        } catch (error) {
            console.error(`Error while escaping comment for review: ${review.username} - ${review.bookname}`, error);
        }

        const query = `
        INSERT INTO userratings (username, bookname, rating, comments) 
        VALUES ('${username}', '${book}', ${review.rate}, '${comment}');
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


/* 
  <button type="button" class="Button Button--secondary Button--small"><span class="Button__labelItem"><span data-testid="loadMore">Show more reviews</span></span><span class="Button__labelItem"><i class="Icon ChevronIcon"><svg viewBox="0 0 24 24"><path d="M8.70710678,9.27397892 C8.31658249,8.90867369 7.68341751,8.90867369 7.29289322,9.27397892 C6.90236893,9.63928415 6.90236893,10.2315609 7.29289322,10.5968662 L12,15 L16.7071068,10.5968662 C17.0976311,10.2315609 17.0976311,9.63928415 16.7071068,9.27397892 C16.3165825,8.90867369 15.6834175,8.90867369 15.2928932,9.27397892 L12,12.3542255 L8.70710678,9.27397892 Z" transform="rotate(0 12 12)"></path></svg></i></span></button>
   bu buttona tıklayınca 

   ReviewsList__listContext bunun yüklenmesini izleyecek  
   */