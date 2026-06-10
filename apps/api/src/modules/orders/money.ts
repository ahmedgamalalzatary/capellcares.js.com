function validateMoney(value: number, name: string) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
  if (value < 0) {
    throw new RangeError(`${name} must be non-negative`);
  }
}

function validateQuantity(value: number, name: string) {
  validateMoney(value, name);
  if (!Number.isInteger(value)) {
    throw new TypeError(`${name} must be an integer`);
  }
}

function toMinorUnits(value: number) {
  validateMoney(value, "value");
  return Math.round(value * 100);
}

function fromMinorUnits(value: number) {
  validateMoney(value, "value");
  return value / 100;
}

export function multiplyMoney(amount: number, quantity: number) {
  validateMoney(amount, "amount");
  validateQuantity(quantity, "quantity");
  return fromMinorUnits(toMinorUnits(amount) * quantity);
}

export function addMoney(left: number, right: number) {
  validateMoney(left, "left");
  validateMoney(right, "right");
  return fromMinorUnits(toMinorUnits(left) + toMinorUnits(right));
}
