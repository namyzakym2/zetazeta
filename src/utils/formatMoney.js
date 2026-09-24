function formatMoney(amount) {
  return `${Number(amount).toLocaleString('en-US')} Zeta`;
}

module.exports = { formatMoney };
