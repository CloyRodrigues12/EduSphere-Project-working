export const getErrorMessage = (error) => {
  // 1. Network / Server Down
  if (!error.response) return "Network error. Please check your connection.";

  const data = error.response.data;

  // 2. If it's a simple string
  if (typeof data === "string") return data;

  // 3.Field Error Extraction
  // This grabs the first error message from the first key in the response object
  if (typeof data === "object" && data !== null) {
    const keys = Object.keys(data);

    if (keys.length > 0) {
      const firstKey = keys[0]; // e.g., "email", "password", "detail", "non_field_errors"
      const firstError = data[firstKey];

      // If it's an array (Django standard), take the first item
      if (Array.isArray(firstError)) {
        return firstError[0];
      }
      // If it's a string, return it directly
      if (typeof firstError === "string") {
        return firstError;
      }
    }
  }
  return "An unexpected error occurred. Please try again.";
};
