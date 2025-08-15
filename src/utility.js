import * as d3 from 'd3';


export const calcDataExtent = (data) => {
  const keys = Object.keys(data);
  const concat_x_data = keys.flatMap(key => data[key]["data"].map(d => d[0])); // 将所有x数据合并到一个数组中
  const concat_y_data = keys.flatMap(key => data[key]["data"].map(d => d[1])); // 将所有y数据合并到一个数组中
  return [d3.extent(concat_x_data), d3.extent(concat_y_data)]
}

export const calcDataXExtent = (data) => {
    const keys = Object.keys(data);
    let min = Infinity;
    let max = -Infinity;
    keys.forEach(key => {
        const x_domain = data[key]["x_domain"];
        if (x_domain[0] < min) min = x_domain[0];
        if (x_domain[1] > max) max = x_domain[1];
    })
    return [min, max];
}

export const calcDataYExtent = (data) => {
    let min = Infinity;
    let max = -Infinity;
    const keys = Object.keys(data);
    keys.forEach(key => {
        const y_domain = data[key]["y_domain"];
        if (y_domain[0] < min) min = y_domain[0];
        if (y_domain[1] > max) max = y_domain[1];
    });
    return [min, max];
}

export function generateColorWheelColors(count = 12) {
  const colors = [];
  for (let i = 0; i < count; i++) {
    const hue = Math.round((360 / count) * i); // 均匀分布角度
    colors.push(`hsl(${hue}, 70%, 50%)`);
  }
  return colors;
}

export function interpolateYCoordinate1(data, xValue) {   // data: [[x1, y1], [x2, y2], ...]
  if (data.length === 0) return null; // 如果数据为空，返回null
  if (data.length === 1) return data[0][1]; // 如果只有一个点，直接返回y值
  // assuming data is sorted by xValue
  if (xValue < data[0][0]) {
    return data[0][1];
  } else if (xValue > data[data.length - 1][0]) {
    return data[data.length - 1][1];
  } else {
    for (let i = 0; i < data.length - 1; i++) {
      if (xValue >= data[i][0] && xValue <= data[i + 1][0]) {
        const x0 = data[i][0];
        const y0 = data[i][1];
        const x1 = data[i + 1][0];
        const y1 = data[i + 1][1];
        return y0 + (y1 - y0) * (xValue - x0) / (x1 - x0);
      }
  }
  }
}

export function interpolateYCoordinate(data, xValue) {
  const x = data["x"];
  const y = data["y"];
  const dataLen = data["x"].length;
  if (dataLen === 0) return null;
  if (dataLen === 1) return y[0];

  // assuming data is sorted by xValue
  if (xValue <= x[0]) {
    return y[0];
  }
  if (xValue >= x[dataLen - 1]) {
    return y[dataLen - 1];
  }

  // 二分查找区间
  let low = 0;
  let high = dataLen - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const midX = x[mid];

    if (midX === xValue) {
      return y[mid]; // 刚好匹配
    } else if (midX < xValue) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  // high 是左端点索引，low 是右端点索引
  const x0 = x[high];
  const y0 = y[high];
  const x1 = x[low];
  const y1 = y[low];

  // 线性插值
  return y0 + (y1 - y0) * (xValue - x0) / (x1 - x0);
}

export function sampleArray(arr, step = 10) {
  if (!Array.isArray(arr)) throw new Error("输入必须是数组");
  if (step <= 0) throw new Error("step 必须大于 0");

  const result = [];
  for (let i = 0; i < arr.length; i += step) {
    result.push(arr[i]);
  }
  return result;
}