const formatRupiah = (number) => {
    return new Intl.NumberFormat('id-ID').format(number || 0);
};

module.exports = { formatRupiah };
