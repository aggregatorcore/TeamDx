"use client";

import { useEffect, useRef } from "react";
import { Bell, X } from "lucide-react";

interface NewTaskNotificationProps {
  show: boolean;
  leadName: string;
  leadId: string;
  onClose: () => void;
  onOpenTask: (leadId: string) => void;
}

export default function NewTaskNotification({
  show,
  leadName,
  leadId,
  onClose,
  onOpenTask,
}: NewTaskNotificationProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (show) {
      // Play notification sound
      playNotificationSound();
      
      // Auto-close after 10 seconds
      const timer = setTimeout(() => {
        onClose();
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  const playNotificationSound = () => {
    try {
      // Create audio context for notification sound
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create a simple beep sound
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Configure sound
      oscillator.frequency.value = 800; // Higher pitch
      oscillator.type = "sine";
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
      
      // Play second beep after short delay
      setTimeout(() => {
        const oscillator2 = audioContext.createOscillator();
        const gainNode2 = audioContext.createGain();
        
        oscillator2.connect(gainNode2);
        gainNode2.connect(audioContext.destination);
        
        oscillator2.frequency.value = 1000;
        oscillator2.type = "sine";
        
        gainNode2.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator2.start(audioContext.currentTime);
        oscillator2.stop(audioContext.currentTime + 0.3);
      }, 200);
    } catch (error) {
      console.warn("Could not play notification sound:", error);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right-5 duration-300">
      <div className="bg-white rounded-lg shadow-lg border-2 border-blue-500 p-4 min-w-[320px] max-w-md">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <div className="bg-blue-100 p-2 rounded-full">
              <Bell className="h-5 w-5 text-blue-600 animate-pulse" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">
                New Task Assigned
              </h3>
              <p className="text-sm text-gray-600 mb-2">
                {leadName}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onOpenTask(leadId);
                    onClose();
                  }}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                >
                  Open Task
                </button>
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
