const jsdiff = require('diff');
const fs = require('fs');
const fsPromises = fs.promises;
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const config = {
    storage: {
        html: '/public/html/',
        pdf: '/public/pdf/'
    }
};


// algo without chunks
async function algo() {
    try {
        const packageIdOne = 'BILLS-116hr748eas';
        const packageIdTwo = 'BILLS-116hr748enr';
        const filePath = config.storage.pdf + packageIdOne + '-' + packageIdOne + '.pdf';

        const htmlFilePath = process.cwd() + config.storage.html + packageIdOne + '.html';
        const comparedHtmlFilePath = process.cwd() + config.storage.html + packageIdTwo + '.html';

        const documentContent = await getDocumentContent(htmlFilePath);
        const comparedDocumentContent = await getDocumentContent(comparedHtmlFilePath);


        // const packageIdOne = 'BILLS-116hr748eas';
        // const packageIdTwo = 'BILLS-116hr748enr';
        // const packageIdTwo = 'BILLS-116hr748pcs';
        // const packageIdOne = 'BILLS-116hr748eas-copy-modified';
        // const packageIdTwo = 'BILLS-116hr748enr-copy-modified';
        // const packageIdOne = 'BILLS-116hr748eas-copy-modified';
        // const packageIdTwo = 'BILLS-116hr748pcs-copy-modified';
        // const packageIdTwo = 'BILLS-116hr6322ih-copy';
        // const packageIdOne = 'BILLS-116hr6322rds-copy-modified-2';

        // const difference = jsdiff.diffWords(documentContent, comparedDocumentContent);
        const difference = jsdiff.diffLines(documentContent, comparedDocumentContent);
        console.log('finished');


    } catch (err) {
        console.error(err);
    }
}

function pause(ms) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
}

async function chunkAlgorithm() {
    try {
        // get packages ids

        // two large and similar documents -- it will take a very long time and processor is overloaded
        const packageIdOne = 'BILLS-116hr748eas';
        const packageIdTwo = 'BILLS-116hr748enr';

        // two not large and similar documents -- it will be quite quick
        // const packageIdOne = 'BILLS-116hr6322ih-copy';
        // const packageIdTwo = 'BILLS-116hr6322rds-copy';

        // one large and one small -- it will be a long period of time, but processor is not overloaded as with two similar and large documents
        // const packageIdOne = 'BILLS-116hr748eas';
        // const packageIdTwo = 'BILLS-116hr748pcs';

        // compose file path to save pdf
        const filePath = config.storage.pdf + packageIdOne + '-' + packageIdOne + '.pdf';

        // get path to html files we gonna to compare
        const htmlFilePath = process.cwd() + config.storage.html + packageIdOne + '.html';
        const comparedHtmlFilePath = process.cwd() + config.storage.html + packageIdTwo + '.html';

        // download content into variables
        const documentContent = await getDocumentContent(htmlFilePath);
        const comparedDocumentContent = await getDocumentContent(comparedHtmlFilePath);

        // we split document into lines, 'cause we gonna compare chunks which consist of multiple lines
        const documentContentLines = documentContent.split('\n');
        const comparedDocumentContentLines = comparedDocumentContent.split('\n');

        // define variables for chunk size and pointer
        let pointer = 0;
        // we gonna compare chunks which consist of chunkSize lines
        const chunkSize = 100;
        // here we store differences
        let differences = [];

        // if first document is less than second one
        if (documentContentLines.length < comparedDocumentContentLines.length) {
            while (pointer <= comparedDocumentContentLines.length) {

                console.log(pointer);

                // await pause(50);

                // if first document is over we compare with empty line
                if (pointer >= documentContentLines.length) {
                    differences = differences.concat(jsdiff.diffWords(
                        '',
                        comparedDocumentContentLines.slice(pointer, pointer + chunkSize).join('\n')
                    ));
                } else {
                    differences = differences.concat(jsdiff.diffWords(
                        documentContentLines.slice(pointer, pointer + chunkSize).join('\n'),
                        comparedDocumentContentLines.slice(pointer, pointer + chunkSize).join('\n')
                    ));
                }

                pointer += chunkSize;
            }
        } else {
            while (pointer <= documentContentLines.length) {

                console.log(pointer);

                // await pause(50);

                if(pointer >= comparedDocumentContentLines.length) {
                    differences = differences.concat(jsdiff.diffWords(
                        '',
                        documentContentLines.slice(pointer, pointer + chunkSize).join('\n')
                    ));
                } else {
                    differences = differences.concat(jsdiff.diffWords(
                        documentContentLines.slice(pointer, pointer + chunkSize).join('\n'),
                        comparedDocumentContentLines.slice(pointer, pointer + chunkSize).join('\n')
                    ));
                }

                pointer += chunkSize;
            }
        }

        console.log('algo is finished', differences);

        let body = '';
        const datetime = new Date().toISOString();

        for (let part of differences) {
            let realValue = part.value;
            let value = part.value;
            realValue = realValue.replace(/\</g, '&lt;');
            realValue = realValue.replace(/\>/g, '&gt;');

            if(part.added) {
                console.log('added');
                value = `<span class="insertion" data-author="MarkupLaw" data-date="${datetime}">${realValue}</span>`;
            } else if(part.removed) {
                console.log('removed');
                value = `<span class="deletion" data-author="MarkupLaw" data-date="${datetime}">${realValue}</span>`;
            } else {
                value = realValue;
            }

            body = body + value.replace(/\n/g, '<br/>');
        }

        const html = `
      <!DOCTYPE html>
      <html>
      <head>
      <meta charset='utf-8'>
              <style>
        .insertion {background-color: green;}
        .deletion   {background-color: red;}
        </style>
      </head>
      <body>
        ${body}
      </body>
      </html>`;
        const redlineHtmlFilePath = process.cwd()+config.storage.html+packageIdOne+'-'+packageIdTwo+'.html';
        await fs.promises.writeFile(redlineHtmlFilePath, html);

        // const browser = await puppeteer.launch({ignoreHTTPSErrors: true, headless: true});
        // const page = await browser.newPage();
        // await page.setContent(html);
        // await page.pdf({
        //     path: process.cwd()+filePath,
        //     format: "A4",
        //     margin: {
        //         left: "40px",
        //         top: "40px",
        //         right: "40px",
        //         bottom: "40px"
        //     },
        //     printBackground: true
        // });

    } catch (e) {
        console.error(e);
    }
}

async function getDocumentContent(htmlFilePath) {
    const rawContent = await fsPromises.readFile(htmlFilePath, 'utf8');
    const cheerioObj = cheerio.load(rawContent);

    return cheerioObj('pre').html();
}

// algo().then(() => {
//    console.log('running test algo');
// });

chunkAlgorithm().then(() => {
    console.log('running chunkAlgorithm');
});
