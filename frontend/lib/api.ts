import { useToast } from "@/components/ui/use-toast" // Assuming useToast can be used globally or passed

// Define a type for the API response structure if known
interface ApiResponse<T = any> {
  status: "success" | "error" | "fail"
  message?: string
  data?: T
  accessToken?: string // For potential token refresh responses
  refreshToken?: string
}

// Function to get the access token from localStorage
const getAccessToken = (): string | null => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("accessToken")
  }
  return null
  // Removed redundant return null
}

// Function to clear auth data from localStorage
const clearAuthData = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("accessToken")
    localStorage.removeItem("refreshToken")
    localStorage.removeItem("user")
  }
}

// Function to handle token refresh logic
const handleTokenRefresh = async (): Promise<string | null> => {
  console.log("Attempting token refresh...")
  const refreshToken = typeof window !== "undefined" ? localStorage.getItem("refreshToken") : null

  if (!refreshToken) {
    console.log("No refresh token found.")
    clearAuthData()
    // Consider redirecting or throwing a specific error here
    return null
  }

  try {
    const response = await fetch("http://localhost:5000/api/v1/auth/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken }),
    })

    const data: ApiResponse<{ accessToken: string; refreshToken: string }> = await response.json()

    if (response.ok && data.status === 'success' && data.accessToken && data.refreshToken) {
      console.log("Token refresh successful.")
      if (typeof window !== "undefined") {
        localStorage.setItem("accessToken", data.accessToken)
        localStorage.setItem("refreshToken", data.refreshToken) // Store the new refresh token
      }
      return data.accessToken // Return the new access token
    } else {
      console.error("Token refresh failed:", data.message || `HTTP ${response.status}`)
      clearAuthData()
      // Throw an error or return null to indicate failure
      throw new Error(data.message || "Token refresh failed")
    }
  } catch (error) {
    console.error("Error during token refresh:", error)
    clearAuthData()
    // Redirect to login might be appropriate here, but requires router access
    // window.location.href = '/login';
    return null // Indicate failure
  }
}

/**
 * Makes an authenticated API request.
 * Handles adding the Authorization header and potential 401 errors (token expiry).
 *
 * @param url The API endpoint URL.
 * @param options Fetch options (method, body, etc.).
 * @param isRetry Internal flag to prevent infinite refresh loops.
 * @returns Promise resolving to the JSON response data.
 */
export const fetchAuthenticated = async <T = any>(
  url: string,
  options: RequestInit = {},
  isRetry = false
): Promise<ApiResponse<T>> => {
  const token = getAccessToken()
  const headers = new Headers(options.headers || {})

  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }
  // Ensure Content-Type is set for methods that have a body
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  } // <<< Added missing closing brace

  const backendBaseUrl = "https://vent-4tfv.onrender.com"; // Define the backend base URL
  const fullUrl = url.startsWith("http") ? url : `${backendBaseUrl}${url}`; // Prepend base URL if url is relative

  try {
    const response = await fetch(fullUrl, { // Use fullUrl
      ...options,
      headers,
    })

    // If Unauthorized (token expired?), try to refresh token once
    if (response.status === 401 && !isRetry) {
      console.log("Access token expired or invalid. Attempting refresh...")
      const newAccessToken = await handleTokenRefresh()
      if (newAccessToken) {
        // Retry the original request with the new token
        console.log("Retrying request with new access token.")
        return fetchAuthenticated<T>(url, options, true) // Pass isRetry = true
      } else {
        // Refresh failed, throw error to be caught below
        throw new Error("Session expired. Please log in again.")
      }
    }

    // Attempt to parse JSON, handle potential errors
    let data: ApiResponse<T>
    try {
      data = await response.json()
    } catch (jsonError) {
      // Handle cases where response is not JSON (e.g., 500 server error HTML page)
      console.error("Failed to parse JSON response:", jsonError)
      // Use status text or a generic error message
      throw new Error(response.statusText || `HTTP error ${response.status}`)
    }


    if (!response.ok) {
      // Use error message from API response if available, otherwise use status text
      throw new Error(data?.message || `API Error: ${response.status} ${response.statusText}`)
    }

    return data // Return the parsed JSON data

  } catch (error) {
    console.error("Authenticated fetch error:", error)
    // Re-throw the error to be handled by the calling component/function
    // You might want to show a generic error toast here as well
    // const { toast } = useToast(); // This hook likely needs to be called within a component context
    // toast({ variant: "destructive", title: "API Error", description: error.message });
    throw error // Ensure the error propagates
  }
}

// Example usage (within an async function in a component):
/*
async function fetchUserProfile() {
  try {
    const response = await fetchAuthenticated<{ user: UserType }>('/api/v1/auth/me');
    if (response.status === 'success' && response.data) {
      console.log('User profile:', response.data.user);
      // Update state with user data
    } else {
      // Handle API-specific error messages
      console.error('Failed to fetch profile:', response.message);
    }
  } catch (error) {
    // Handle network errors or errors thrown by fetchAuthenticated
    console.error('Error fetching user profile:', error);
    // Show error toast to user
  }
}
*/
