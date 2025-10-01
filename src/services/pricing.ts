const defaultPricing = [
  { months: 1, price: 9.99 },
  { months: 3, price: 27.99 },
  { months: 6, price: 53.99 },
  { months: 12, price: 99.99 }
];

export const pricing = {
  currency() { return 'USD'; },
  expectedAmount(months: number): number | null {
    const row = defaultPricing.find(r => r.months === months);
    return row ? row.price : null;
  },
  computeDueAmount(_device: any): number { return 9.99; }
};
