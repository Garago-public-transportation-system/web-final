import cv2
import requests
import time
import threading
from ultralytics import YOLO

# Configuration
# =======================================================
BACKEND_URL = "http://localhost:8000/api/v1/hardware/camera"
API_KEY = "20fb404802c3950a14ecd47f7dd3fd70bdd2cd850ad55f630d551b7d0b435b85"
# Change this to the ID of an active trip you want to test with
TRIP_ID = 299
UPDATE_INTERVAL_SECONDS = 5
# =======================================================

# Load YOLOv8 nano model (fast and lightweight)
# It will download the yolov8n.pt weights file automatically on first run
model = YOLO('yolov8n.pt')

# Global variable to store the latest passenger count
latest_count = 39
running = True

def send_data_to_backend():
    """Background thread function to send data periodically."""
    global latest_count, running
    
    headers = {
        "x-hardware-api-key": API_KEY,
        "Content-Type": "application/json"
    }
    
    while running:
        # Sleep in small chunks so we can exit the thread quickly when running=False
        for _ in range(UPDATE_INTERVAL_SECONDS * 10):
            if not running:
                return
            time.sleep(0.1)
            
        payload = {
            "trip_id": TRIP_ID,
            "passenger_count": latest_count
        }
        
        try:
            print(f"Sending passenger count: {latest_count} for Trip ID: {TRIP_ID}")
            response = requests.post(BACKEND_URL, json=payload, headers=headers, timeout=3)
            if response.status_code == 200:
                print(f"Success: {response.json()}")
            else:
                print(f"Error {response.status_code}: {response.text}")
        except Exception as e:
            print(f"Failed to connect to backend: {e}")

def main():
    global latest_count, running
    
    # Start the backend reporting thread
    reporter_thread = threading.Thread(target=send_data_to_backend, daemon=True)
    reporter_thread.start()

    # Open USB Webcam (0 is usually the built-in or first USB webcam)
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("Error: Could not open webcam.")
        running = False
        return

    print("Starting live feed... Press 'q' in the window to quit.")
    
    while running:
        ret, frame = cap.read()
        if not ret:
            print("Error: Failed to grab frame.")
            break
            
        # Run YOLOv8 inference on the frame
        # classes=0 filters for 'person' only (ignores cars, dogs, etc.)
        results = model(frame, classes=0, verbose=False)
        
        # Count the number of people detected
        current_count = len(results[0].boxes)
        latest_count = current_count
        
        # Draw bounding boxes and count on the frame
        annotated_frame = results[0].plot()
        
        # Add a custom overlay for the count
        cv2.putText(
            annotated_frame, 
            f"Passengers: {current_count}", 
            (20, 50), 
            cv2.FONT_HERSHEY_SIMPLEX, 
            1.5, 
            (0, 255, 0), # Green text
            3
        )
        
        # Show the live feed UI window
        cv2.imshow("Garago Bus Camera System", annotated_frame)
        
        # Press 'q' to exit
        if cv2.waitKey(1) & 0xFF == ord('q'):
            running = False
            break
            
    # Cleanup
    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
