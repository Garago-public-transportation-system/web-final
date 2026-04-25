import React from 'react';
import { Link } from 'react-router-dom';

const Unauthorized = () => {
    return (
        <div className="flex flex-col items-center justify-center h-screen">
            <h1 className="text-4xl font-bold text-red-600 mb-4">403 - Unauthorized</h1>
            <p className="text-gray-600 mb-8">You do not have permission to access this page.</p>
            <Link to="/" className="text-blue-500 hover:underline">Go Home</Link>
        </div>
    );
};

export default Unauthorized;
