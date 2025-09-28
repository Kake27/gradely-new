"use client"

import ProtectedRoute from "../context/ProtectedRoute"

export default function FacultyDashboard() {
    return (
        <ProtectedRoute roles={["faculty"]}>
            <div>
                
            </div>
        </ProtectedRoute>
    )
}