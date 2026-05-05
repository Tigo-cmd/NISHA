import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export const apiClient = axios.create({
    baseURL: API_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

// Response Interceptor for error handling
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error("API Error:", error.response?.data || error.message);
        return Promise.reject(error);
    }
);

// Agent Services
export const agentService = {
    getAll: () => apiClient.get("/agents"),
    getById: (id: string) => apiClient.get(`/agents/${id}`),
    updateStatus: (id: string, status: string) =>
        apiClient.patch(`/agents/${id}/status`, { status }),
};

// Alert Services
export const alertService = {
    getAll: (params?: any) => apiClient.get("/audio/events", { params }),
    acknowledge: (id: string) => apiClient.post(`/audio/events/${id}/confirm`),
};

// Master Services
export const masterService = {
    getAll: () => apiClient.get("/masters"),
    getHealth: () => apiClient.get("/masters/health"),
};
