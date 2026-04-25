// Session & Idle Timeout Configuration
// These values can be overridden via Vite environment variables (VITE_ prefix)
// e.g., in .env: VITE_IDLE_TIMEOUT_MINUTES=20

export const SESSION_CONFIG = {
    // Minutes of inactivity before the warning dialog appears
    IDLE_TIMEOUT_MINUTES: parseInt(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES || '15', 10),

    // Seconds the user has to respond to the warning before auto-logout
    IDLE_WARNING_SECONDS: parseInt(import.meta.env.VITE_IDLE_WARNING_SECONDS || '60', 10),

    // DOM events that count as "activity"
    ACTIVITY_EVENTS: ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'],
};
