"use client";
import Link from "next/link";
import React from "react";

export const Logo = () => {
  return (
    <Link
      href="/"
      className="font-normal flex space-x-2 items-center text-sm mr-4 text-foreground px-2 py-1 relative z-20"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6"
      >
        <path
          d="M12 3L4 9V20H9V14H15V20H20V9L12 3Z"
          fill="currentColor"
          opacity="0.15"
        />
        <path
          d="M8 12C8 9.8 9.8 8 12 8C14.2 8 16 9.8 16 12"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M12 8V5M12 5L10 6.5M12 5L14 6.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect
          x="9"
          y="14"
          width="6"
          height="7"
          rx="1"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
        <line x1="12" y1="14" x2="12" y2="21" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      </svg>
      <span className="font-medium text-foreground">VirtuTry</span>
    </Link>
  );
};
