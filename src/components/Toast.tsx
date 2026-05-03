"use client"

import { useEffect, useState } from "react"

interface ToastProps {
  message: string
  type?: "success" | "error" | "info"
  onClose: () => void
}

export default function Toast({ message, type = "success", onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  const bgColor = type === "success" ? "#22c55e" : type === "error" ? "#ef4444" : "#3b82f6"
  
  return (
    <div 
      className="fixed top-4 right-4 px-4 py-3 rounded-lg shadow-lg text-white z-50"
      style={{ backgroundColor: bgColor }}
    >
      {message}
    </div>
  )
}