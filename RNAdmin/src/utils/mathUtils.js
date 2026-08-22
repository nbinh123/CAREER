// [GIU-NGUYEN] copy nguyên vẹn 100% — thuần toán học, dùng chung cho
// AnalystPage / 10 chart component khi chuyển ở Giai đoạn 5.
// utils/mathUtils.js

// Tính Simple Moving Average (SMA)
exports.calculateSMA = (data, period) => {
  let sma = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(null);
      continue;
    }
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j];
    }
    sma.push(sum / period);
  }
  return sma;
};

// Tính Exponential Moving Average (EMA)
exports.calculateEMA = (data, period) => {
  let ema = [];
  let multiplier = 2 / (period + 1);

  let initialSMA = data.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      ema.push(null);
    } else if (i === period - 1) {
      ema.push(initialSMA);
    } else {
      let currentEMA = (data[i] - ema[i - 1]) * multiplier + ema[i - 1];
      ema.push(currentEMA);
    }
  }
  return ema;
};

// PID Controller tính toán bù trừ dự đoán nguyên liệu
exports.calculatePID = (actualDemand, predictedDemand, previousError, integral, Kp = 0.5, Ki = 0.1, Kd = 0.05) => {
  let error = actualDemand - predictedDemand;
  let newIntegral = integral + error;
  let derivative = error - previousError;
  let adjustment = (Kp * error) + (Ki * newIntegral) + (Kd * derivative);

  return {
    adjustment: adjustment,
    newError: error,
    newIntegral: newIntegral,
  };
};
