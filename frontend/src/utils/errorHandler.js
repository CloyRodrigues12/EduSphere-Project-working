export const getErrorMessage = (error) => {
  if (!error.response) return "Network error. Please check your connection.";

  const data = error.response.data;

  // 1. If it's a simple string (rare but possible)
  if (typeof data === "string") return data;

  // 2. Check for specific field errors (Common in Django)
  // We prioritize password errors since they are most critical here
  if (data.new_password1)
    return Array.isArray(data.new_password1)
      ? data.new_password1[0]
      : data.new_password1;
  if (data.password)
    return Array.isArray(data.password) ? data.password[0] : data.password;
  if (data.username)
    return Array.isArray(data.username) ? data.username[0] : data.username;
  if (data.email) return Array.isArray(data.email) ? data.email[0] : data.email;
  if (data.token) return "This reset link is invalid or has expired.";
  if (data.uid) return "Invalid user ID.";

  // 3. Check for non_field_errors (General errors)
  if (data.non_field_errors) {
    return Array.isArray(data.non_field_errors)
      ? data.non_field_errors[0]
      : data.non_field_errors;
  }

  // 4. Fallback for generic detail
  if (data.detail) return data.detail;

  // 5. Fallback
  return "An unexpected error occurred. Please try again.";
};
