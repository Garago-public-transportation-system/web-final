import { useEffect, useRef, useState, useCallback } from 'react';
import { SESSION_CONFIG } from '../config/session';

/**
 * Hook that tracks user inactivity.
 * - After IDLE_TIMEOUT_MINUTES of no activity → sets `isWarning` to true
 * - After IDLE_WARNING_SECONDS more → calls `onIdle` (auto-logout)
 * - Any user activity during normal phase resets the timer
 * - Calling `stayActive()` during warning phase resets everything
 */
const useIdleTimer = ({ onIdle, enabled = true }) => {
    const [isWarning, setIsWarning] = useState(false);
    const [countdown, setCountdown] = useState(SESSION_CONFIG.IDLE_WARNING_SECONDS);

    const idleTimerRef = useRef(null);
    const countdownTimerRef = useRef(null);
    const isWarningRef = useRef(false);
    const onIdleRef = useRef(onIdle);

    // Keep callback ref in sync
    useEffect(() => {
        onIdleRef.current = onIdle;
    }, [onIdle]);

    const clearAllTimers = useCallback(() => {
        if (idleTimerRef.current) {
            clearTimeout(idleTimerRef.current);
            idleTimerRef.current = null;
        }
        if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
        }
    }, []);

    const resetIdleTimer = useCallback(() => {
        clearAllTimers();
        isWarningRef.current = false;
        setIsWarning(false);
        setCountdown(SESSION_CONFIG.IDLE_WARNING_SECONDS);

        idleTimerRef.current = setTimeout(() => {
            // Idle timeout reached — show warning
            isWarningRef.current = true;
            setIsWarning(true);
            let remaining = SESSION_CONFIG.IDLE_WARNING_SECONDS;
            setCountdown(remaining);

            countdownTimerRef.current = setInterval(() => {
                remaining -= 1;
                setCountdown(remaining);
                if (remaining <= 0) {
                    clearInterval(countdownTimerRef.current);
                    countdownTimerRef.current = null;
                    onIdleRef.current();
                }
            }, 1000);
        }, SESSION_CONFIG.IDLE_TIMEOUT_MINUTES * 60 * 1000);
    }, [clearAllTimers]);

    // Reset everything — user clicked "Stay Logged In"
    const stayActive = useCallback(() => {
        resetIdleTimer();
    }, [resetIdleTimer]);

    useEffect(() => {
        if (!enabled) {
            clearAllTimers();
            return;
        }

        const handleActivity = () => {
            // Only reset during normal phase, not during warning countdown
            if (!isWarningRef.current) {
                resetIdleTimer();
            }
        };

        // Initial start via a microtask to avoid synchronous setState in effect
        const initId = setTimeout(() => resetIdleTimer(), 0);

        // Attach DOM listeners
        SESSION_CONFIG.ACTIVITY_EVENTS.forEach((event) => {
            window.addEventListener(event, handleActivity, { passive: true });
        });

        return () => {
            clearTimeout(initId);
            clearAllTimers();
            SESSION_CONFIG.ACTIVITY_EVENTS.forEach((event) => {
                window.removeEventListener(event, handleActivity);
            });
        };
    }, [enabled, resetIdleTimer, clearAllTimers]);

    return { isWarning, countdown, stayActive };
};

export default useIdleTimer;
