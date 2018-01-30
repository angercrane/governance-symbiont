export const randomInt = (min, max, random = Math.random) => {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(random() * (max - min)) + min
}

export const randomEntry = (array, random = Math.random) =>
  array[randomInt(0, array.length, random)]
