const extractNumber = (str) => {
    let separator = str.includes('-') ? '-' : '@';
    let numberBeforeSeparator = str.split(separator)[0];
    return numberBeforeSeparator;
};

module.exports = { extractNumber };