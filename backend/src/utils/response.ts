export function ok<T>(data: T, message = "OK") {
  return {
    success: true,
    message,
    data
  };
}

export function created<T>(data: T, message = "Created") {
  return {
    success: true,
    message,
    data
  };
}
