const moment = require('moment-timezone');

const getWIBTime = () => {
    return moment().tz('Asia/Jakarta');
};

const formatWIB = (format = 'HH:mm:ss') => {
    return getWIBTime().format(format);
};

const formatDateTimeWIB = () => {
    return getWIBTime().format('DD/MM/YYYY HH:mm:ss') + ' WIB';
};

const formatDayDateWIB = () => {
    moment.locale('id');
    return {
        hari: getWIBTime().locale('id').format('dddd'),
        tanggal: getWIBTime().locale('id').format('DD MMMM YYYY'),
        jam: getWIBTime().format('HH:mm')
    };
};

module.exports = { getWIBTime, formatWIB, formatDateTimeWIB, formatDayDateWIB };
