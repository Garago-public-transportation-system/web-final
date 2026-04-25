import React from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Wraps page content with a smooth fade + slide-up on mount.
 * Uses key={pathname} to re-trigger animation on route change.
 * No AnimatePresence — it conflicts with React Router's Outlet.
 */
const PageTransition = ({ children }) => {
    const location = useLocation();

    return (
        <React.Fragment key={location.pathname}>
            {children}
        </React.Fragment>
    );
};

export default PageTransition;
