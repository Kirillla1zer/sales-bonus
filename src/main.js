/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
// purchase — это одна из записей в поле items из чека в data.purchase_records
// _product — это продукт из коллекции data.products
function calculateSimpleRevenue(purchase, _product) {
  // Расчет выручки от операции
  const discount = 1 - purchase.discount / 100;
  return purchase.sale_price * purchase.quantity * discount;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
  // Расчет бонуса от позиции в рейтинге(профит)
  const { profit } = seller;

  const firstByprofit = 0.15;
  const secondOrThirstByProfit = 0.1;
  const otherByProfit = 0.05;
  const lastByProfit = 0;

  if (index === 0) {
    return profit * firstByprofit;
  }

  if (index === 1 || index === 2) {
    return profit * secondOrThirstByProfit;
  }

  if (index === total - 1) {
    return profit * lastByProfit;
  }

  return profit * otherByProfit;
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options //обьект с методами
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
  // @TODO: Проверка входных данных

  if (
    !data ||
    !Array.isArray(data.sellers) ||
    !Array.isArray(data.purchase_records) ||
    !Array.isArray(data.customers) ||
    !Array.isArray(data.products) ||
    data.sellers.length === 0 ||
    data.purchase_records.length === 0 ||
    data.customers.length === 0 ||
    data.products.length === 0
  ) {
    throw new Error("Некорректные входные данные");
  }

  // @TODO: Проверка наличия опций
  //Ошибки
  if (!typeof options === "object") {
    throw new Error("Некорректные входные опции(не обьект)");
  }

  const { calculateRevenue, calculateBonus } = options;

  if (!calculateRevenue || !calculateBonus) {
    throw new Error("Чего-то не хватает(одна или более из опций пуста");
  }

  // @TODO: Подготовка промежуточных данных для сбора статистики
  //Итогвый отчёт в который заполняем для отслеживания в итоге
  const sellersStats = data.sellers.map((seller) => {
    return {
      id: seller.id,
      name: `${seller.first_name} ${seller.last_name}`,
      revenue: 0,
      profit: 0,
      sales_count: 0,
      products_sold: {},
    };
  });

  // Индексация продавцов и товаров для быстрого доступа

  //(Индексация продавцов по чекам)
  //{seller_id:[Чеки связанные с ним]}
  const sellersByPurchaseRecords = data.purchase_records.reduce((acc, item) => {
    if (!acc[item.seller_id]) {
      acc[item.seller_id] = [];
    }
    acc[item.seller_id].push(item);
    return acc;
  }, {});

  //(Индексация продуктов
  // {skuID:purchase_price})
  const productsBySku = data.products.reduce((acc, item) => {
    acc[item.sku] = item.purchase_price;
    return acc;
  }, {});

  // Расчет выручки,прибыли и считаем кол-во проданного товара по артикулу для каждого продавца
  Object.keys(sellersByPurchaseRecords).forEach((key) => {
    sellersByPurchaseRecords[key].forEach((value) => {
      sellersStats.find((seller) => key == seller.id).sales_count += 1;

      value.items.forEach((item) => {
        //Считаем выручку(без округления плавающей точки то не сходится итог по выручке)
        sellersStats.find((seller) => key == seller.id).revenue +=
          +calculateSimpleRevenue(item).toFixed(2);

        //Считаем прибыль(выручка - себестоимость товара)
        sellersStats.find((seller) => key == seller.id).profit +=
          calculateSimpleRevenue(item) -
          productsBySku[item.sku] * item.quantity;

        //Считаем кол-во продаванного товара по артикулу
        if (!sellersStats.find((seller) => key == seller.id).products_sold[item.sku]) {
          sellersStats.find((seller) => key == seller.id).products_sold[item.sku] = 0;
        }
        sellersStats.find((seller) => key == seller.id).products_sold[item.sku] += item.quantity;
      });
    });
  });

  // Сортировка продавцов по прибыли
  sellersStats.sort((a, b) => {
    if (a.profit < b.profit) {
      return 1;
    }
    if (a.profit > b.profit) {
      return -1;
    }
    if ((a.profit = b.profit)) {
      return 0;
    }
  });
  // Назначение премий на основе ранжирования
  for (let i = 0; i < sellersStats.length; i++) {
    sellersStats[i].bonus = calculateBonusByProfit(
      i,
      sellersStats.length,
      sellersStats[i]
    );
  }
  //Формируем топ 10 продуктов для каждого продавца

  sellersStats.forEach((item) => {
    item.products_sold = Object.entries(item.products_sold)
      .map((product) => {
        return { sku: product[0], quantity: product[1] };
      })
      .sort((a, b) => {
        if (a.quantity > b.quantity) return -1;
        if (a.quantity < b.quantity) return 1;
        if ((a.quantity = b.quantity)) return 0;
      })
      .slice(0, 10);
  });
  // Подготовка итоговой коллекции с нужными полями
  return sellersStats.map((seller) => ({
    seller_id: seller.id,
    name: seller.name,
    revenue: +seller.revenue.toFixed(2),
    profit: +seller.profit.toFixed(2),
    sales_count: +seller.sales_count.toFixed(2),
    top_products: seller.products_sold,
    bonus: +seller.bonus.toFixed(2),
  }));
}
