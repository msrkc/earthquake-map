const express = require("express");
const app = express();
const fetch = require("@zeit/fetch-retry")(require("node-fetch"));
const cheerio = require("cheerio");
const cron = require("node-cron");

const noParenthesis = val => {
  const regExp = /\(([^)]+)\)/;
  const array = regExp.exec(val);
  return Array.isArray(array) ? array[1] : val;
};

async function getirDepremler() {
  let depremler = [];
  const kandilli = await fetch("http://www.koeri.boun.edu.tr/scripts/lst0.asp");
  const html = await kandilli.text();
  const $ = cheerio.load(html, {
    decodeEntities: false
  });
  const response = $("pre").text();

  let result = response.split("\n");
  result = result.splice(6, result.length + 1);

  result.forEach(element => {
    const depremString = element.split(" ");

    const depremBilgi = [];
    for (let i = 0; i < depremString.length; i++) {
      if (depremString[i].length > 0 && !depremString[i].includes("lksel")) {
        depremBilgi.push(depremString[i].toLowerCase());
      }
    }

    const tarih = depremBilgi[0];
    const saat = depremBilgi[1];
    const enlem = depremBilgi[2];
    const boylam = depremBilgi[3];
    const derinlik = depremBilgi[4];
    const buyukluk = depremBilgi[6];
    const yer = depremBilgi[8];
    const sehir = noParenthesis(depremBilgi[9]);

    const deprem = {
      tarih,
      saat,
      enlem,
      boylam,
      derinlik,
      buyukluk,
      yer,
      sehir
    };

    depremler.push(deprem);
  });

  return depremler.length > 1 ? Promise.resolve(depremler) : Promise.reject();
}

cron.schedule("*/1 * * * *", async () => {
  let tryAgain;
  do {
    try {
      global.depremler = await getirDepremler();
      tryAgain = false;
    } catch (error) {
      tryAgain = true;
    }
  } while (tryAgain);
});

const depremlerArray = async function(req, res, next) {
  if (!global.depremler) {
    const depremler = await getirDepremler();
    global.depremler = depremler;
    res.depremler = global.depremler;
  } else {
    res.depremler = global.depremler;
  }
  next();
};

app.use(depremlerArray);

app.get("/api/filter", (req, res) => {
  const depremler = res.depremler;
  const params = req.query;
  const keys = Object.keys(params);
  let filtered = [...depremler];
  for (key of keys) {
    if (["sehir", "tarih"].includes(key)) {
      filtered = filtered.filter(deprem => deprem[key] === params[key]);
    }
    if (key === "saat") {
      filtered = filtered.filter(deprem => {
        if (
          parseFloat(deprem.saat ? deprem.saat.split(":")[0] : "") ===
          parseFloat(params["saat"])
        ) {
          return deprem;
        }
      });
    }
    if (key === "max") {
      filtered = filtered.filter(
        deprem => parseFloat(deprem.buyukluk) <= parseFloat(params["max"])
      );
    }
    if (key === "min") {
      filtered = filtered.filter(
        deprem => parseFloat(deprem.buyukluk) >= parseFloat(params["min"])
      );
    }
  }
  return res.json(filtered);
});

app.get("/api", function(req, res) {
  res.json(res.depremler);
});

app.use(express.static("public"));

const port = process.env.PORT || 1999;

app.listen(port, () => console.log(`http://localhost:${port}`));
