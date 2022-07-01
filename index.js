import express from 'express';
import axios from 'axios';
import cors from 'cors';
import {create} from './txHashDb/txHashDb.js'
import {
  TOMORROW,
  WEEK,
  TWO_WEEK,
  MONTH,
  getFutureTimestamp,
  getLastDay,
  getCurrentDay,
} from './dates/dates.js';

const app = new express();
const port = 3001;
const apiUrl = 'https://deribit.com/api/v2/public';
const strikeStep = 100;


app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/', async (req, res) => {
  res.status(200).send({ succes: true });
  console.log('success');
});

app.listen(port, async function () {
  console.log('Server ready on port ' + port);
  // try {
  //   const result = await axios.post('http://localhost:3001/order_data', {
  //     price: 1200,
  //     period: 1656583304687,
  //   });
  //   console.log(result.data);
  //   // console.log(getCurrentDay("22-06-22"))
  // } catch (e) {
  //   console.log(e);
  // }
});

app.get('/get_dates', async (req, res) => {
  axios
    .get(`${apiUrl}/get_book_summary_by_currency?currency=ETH&kind=option`)
    .then((apiRes) => {
      const fillteredDate = apiRes.data.result.filter((item) => {
        const [_, stortedDataUnderlying_index] =
          item.underlying_index.split('-');
        const date = new Date(Date.parse(stortedDataUnderlying_index));
        return date >= getCurrentDay() && date <= getLastDay();
      });

      res.json(fillteredDate);
    })
    .catch((err) => console.log(err.apiRes.data));
});

app.get('/get_strikes', async (req, res) => {
  let strikes = [];
  axios
    .get(`${apiUrl}/get_book_summary_by_currency?currency=ETH&kind=option`)
    .then((apiRes) => {});

  for (data of jsonData) {
    const strike = Number(data.instrument_name.split('-')[2]);
    strikes.push({ strike, data });
  }
  for (data of strikes) {
  }
  //TODO Вытащить все старйки интересующих нас цен
});

app.get('/prices', async (req, res) => {
  axios
    .get(`${apiUrl}/get_book_summary_by_currency?currency=ETH&kind=option`)
    .then((apiRes) => {
      const currentPrice = apiRes.data.result[0].estimated_delivery_price; // TODO Получить цену текущую
      const prices = [];
      console.log('currentPrice', currentPrice);
      const formatedCurrentPrice = Math.round(currentPrice / 100) * 100;
      console.log('formatedCurrentPrice', currentPrice);
      for (let i = -4; i < 4; i++)
        prices.push(formatedCurrentPrice + i * strikeStep);
      res.json({ success: true, data: { currentPrice, prices } });
    })
    .catch((err) => console.log(err.apiRes.data));
});

app.get('/periods', async (req, res) => {
  const periods = [
    {
      title: 'Tomorow',
      key: 'tomorow',
      timestamp: getFutureTimestamp(TOMORROW),
    },
    { title: '1 Week', key: 'week', timestamp: getFutureTimestamp(WEEK) },
    { title: 'One Week', key: '1week', timestamp: getFutureTimestamp(WEEK) },
    {
      title: 'Two Week',
      key: '2week',
      timestamp: getFutureTimestamp(TWO_WEEK),
    },
    { title: 'One Month', key: '1month', timestamp: getFutureTimestamp(MONTH) },
  ];
  console.log(periods);
  res.json({ success: true, data: { periods } });
});

app.get('/order_data', (req, res) => {
  axios
    .get(`${apiUrl}/get_book_summary_by_currency?currency=ETH&kind=option`)
    .then((apiRes) => {
      try {
        const { period, price, amount } = req.query;

        const fillteredPrices = apiRes.data.result.filter(
          (item) =>
            item.estimated_delivery_price > price - 100 &&
            item.estimated_delivery_price <= price
        );

        const fillteredDates = fillteredPrices.filter((item) => {
          const [_, stortedDataUnderlying_index] =
            item.underlying_index.split('-');
            period = new Date(
            Date.parse(stortedDataUnderlying_index)
          ).getTime();
          return period >= getCurrentDay() && period <= getLastDay();
        });

        const bidPriceAvailable = fillteredDates.filter(
          (item) => item.bid_price
        );

        if (!bidPriceAvailable.length) throw "Order wasn't found";

        const maxBidPriceObj = bidPriceAvailable
          .sort((a, b) =>
            a.bid_price > b.bid_price ? 1 : b.bid_price > a.bid_price ? -1 : 0
          )
          .reverse()[0];
        const { estimated_delivery_price, bid_price } = maxBidPriceObj;
        const recieve = estimated_delivery_price * bid_price * amount * 0.7;

        res.json({ success: true, data: { ...maxBidPriceObj, recieve } });
      } catch (e) {
        res.json({ success: false, error: e, data: null });
      }
    });
});

app.post('/order_data', (req, res) => {
  const amount = 1.5
  const txHash = "0xc21efc9a1f8288a6e7b7f5eae2d9c7fc3fce9485f129b08c2d0b2b262c5fc040"
});

create()
