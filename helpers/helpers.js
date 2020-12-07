module.exports.between = (x, min, max, round = false) => {
    if (min && x < min) {
        x = min;
    } else if (max && x > max) {
        x = max;
    }

    if (round) {
        return Math.round(x);
    } else {
        return x;
    }
};
