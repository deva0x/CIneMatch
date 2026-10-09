#!/usr/bin/env python3
"""
CineMatch Local Server & Mobile Wi-Fi Sharing Helper
With built-in JSON API for live friend recommendations and name-tracked reactions.
"""

import http.server
import socket
import socketserver
import os
import sys
import json
import time
import urllib.parse

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

PORT = 3000
DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'recommendations.json')

DEFAULT_RECOMMENDATIONS = []

def load_data():
    if not os.path.exists(DATA_FILE):
        save_data(DEFAULT_RECOMMENDATIONS)
        return DEFAULT_RECOMMENDATIONS
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            # Normalize reactions and comments
            for item in data:
                if "reactions" not in item or not isinstance(item["reactions"], dict):
                    item["reactions"] = {"beg": [], "hyped": [], "loved": [], "liked": [], "disliked": [], "hated": []}
                for k in ["beg", "hyped", "loved", "liked", "disliked", "hated"]:
                    if not isinstance(item["reactions"].get(k), list):
                        item["reactions"][k] = []
                if "comments" not in item or not isinstance(item.get("comments"), list):
                    item["comments"] = []
            return data
    except Exception:
        return DEFAULT_RECOMMENDATIONS

def save_data(data):
    try:
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print("Error saving data:", e)

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

class CineMatchHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == '/api/recommendations':
            data = load_data()
            payload = json.dumps(data).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        # Default static file serving
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        content_len = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_len).decode('utf-8')

        try:
            req_json = json.loads(body) if body else {}
        except Exception:
            req_json = {}

        if parsed.path == '/api/recommendations':
            data = load_data()
            rec_by = req_json.get("recommendedBy", "Friend").strip() or "Friend"
            initial_verdict = req_json.get("initialVerdict", "loved")

            new_item = {
                "id": req_json.get("id", f"rec-{len(data) + 1}"),
                "movieId": req_json.get("movieId", ""),
                "tmdbId": req_json.get("tmdbId", None),
                "title": req_json.get("title", "Untitled"),
                "year": req_json.get("year", ""),
                "imdbRating": req_json.get("imdbRating", "7.5"),
                "poster": req_json.get("poster", ""),
                "genres": req_json.get("genres", []),
                "director": req_json.get("director", ""),
                "synopsis": req_json.get("synopsis", ""),
                "trailerId": req_json.get("trailerId", ""),
                "recommendedBy": rec_by,
                "note": req_json.get("note", ""),
                "timestamp": "Just now",
                "reactions": {
                    "beg": [rec_by] if initial_verdict == "beg" else [],
                    "hyped": [rec_by] if initial_verdict == "hyped" else [],
                    "loved": [rec_by] if initial_verdict == "loved" else [],
                    "liked": [rec_by] if initial_verdict == "liked" else [],
                    "disliked": [],
                    "hated": []
                },
                "comments": []
            }
            # Prepend to list
            data.insert(0, new_item)
            save_data(data)

            resp_payload = json.dumps({"success": True, "item": new_item}).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(resp_payload)))
            self.end_headers()
            self.wfile.write(resp_payload)
            return

        elif parsed.path == '/api/comments':
            data = load_data()
            rec_id = req_json.get("id")
            comment_data = req_json.get("comment", {})
            target_item = None
            delete_comment_id = req_json.get("deleteCommentId")

            for item in data:
                if item.get("id") == rec_id:
                    if "comments" not in item or not isinstance(item["comments"], list):
                        item["comments"] = []
                    if delete_comment_id:
                        item["comments"] = [c for c in item["comments"] if c.get("id") != delete_comment_id]
                        target_item = item
                        save_data(data)
                    elif comment_data and comment_data.get("text", "").strip():
                        new_comment = {
                            "id": comment_data.get("id", f"c-{int(time.time()*1000)}"),
                            "author": comment_data.get("author", "Friend").strip() or "Friend",
                            "text": comment_data.get("text", "").strip(),
                            "timestamp": comment_data.get("timestamp", "Just now")
                        }
                        item["comments"].append(new_comment)
                        target_item = item
                        save_data(data)
                    else:
                        target_item = item
                    break

            resp_payload = json.dumps({
                "success": bool(target_item),
                "comments": target_item.get("comments", []) if target_item else []
            }).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(resp_payload)))
            self.end_headers()
            self.wfile.write(resp_payload)
            return

        elif parsed.path == '/api/reactions':
            data = load_data()
            rec_id = req_json.get("id")
            reaction_type = req_json.get("reaction") # 'beg', 'hyped', 'loved', 'liked', 'disliked', 'hated'
            user_name = req_json.get("userName", "").strip()

            found = False
            for item in data:
                if item.get("id") == rec_id:
                    if "reactions" not in item or not isinstance(item["reactions"], dict):
                        item["reactions"] = {"beg": [], "hyped": [], "loved": [], "liked": [], "disliked": [], "hated": []}
                    
                    for k in ["beg", "hyped", "loved", "liked", "disliked", "hated"]:
                        if not isinstance(item["reactions"].get(k), list):
                            item["reactions"][k] = []

                    if user_name and reaction_type in item["reactions"]:
                        already_in = any(u.lower() == user_name.lower() for u in item["reactions"][reaction_type])
                        
                        # Remove user from all reaction buckets first
                        for k in ["beg", "hyped", "loved", "liked", "disliked", "hated"]:
                            item["reactions"][k] = [u for u in item["reactions"][k] if u.lower() != user_name.lower()]

                        # If they weren't already in this bucket, add them
                        if not already_in:
                            item["reactions"][reaction_type].append(user_name)

                        found = True
                        break

            if found:
                save_data(data)

            resp_payload = json.dumps({"success": found, "reactions": item.get("reactions") if found else None}).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(resp_payload)))
            self.end_headers()
            self.wfile.write(resp_payload)
            return

        elif parsed.path == '/api/recommendations/delete':
            data = load_data()
            rec_id = req_json.get("id")
            user_name = req_json.get("userName", "").strip().lower()

            initial_len = len(data)
            # Only delete if user is the author
            data = [
                item for item in data
                if not (item.get("id") == rec_id and item.get("recommendedBy", "").strip().lower() == user_name)
            ]

            deleted = len(data) < initial_len
            if deleted:
                save_data(data)

            resp_payload = json.dumps({"success": deleted}).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(resp_payload)))
            self.end_headers()
            self.wfile.write(resp_payload)
            return

        self.send_response(404)
        self.end_headers()

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed.query)
        rec_id = qs.get("id", [None])[0]
        user_name = qs.get("userName", [""])[0].strip().lower()

        data = load_data()
        initial_len = len(data)
        data = [
            item for item in data
            if not (item.get("id") == rec_id and item.get("recommendedBy", "").strip().lower() == user_name)
        ]

        deleted = len(data) < initial_len
        if deleted:
            save_data(data)

        resp_payload = json.dumps({"success": deleted}).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(resp_payload)))
        self.end_headers()
        self.wfile.write(resp_payload)

def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    load_data() # initialize file if missing
    ip = get_local_ip()

    port = PORT
    handler = CineMatchHandler

    server = None
    for p in range(PORT, PORT + 20):
        try:
            server = socketserver.TCPServer(("", p), handler)
            port = p
            break
        except OSError:
            continue

    if not server:
        print("❌ Could not bind to an open port.")
        sys.exit(1)

    print("\n" + "=" * 64)
    print("  🍿  CineMatch — Friends' Movie Recommendations & Ratings  🍿")
    print("=" * 64)
    print(f"\n  💻 On this computer:")
    print(f"     👉 http://localhost:{port}")
    print(f"\n  📱 On your phone & friends' phones (Same Wi-Fi):")
    print(f"     👉 http://{ip}:{port}")
    print("\n  ✨ Names & Reactions tracked: See exactly who loved,")
    print("     liked, or hated each movie in real-time!")
    print("=" * 64)
    print("  Press Ctrl + C to stop the server.\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 Server stopped. Happy movie watching!")

if __name__ == '__main__':
    main()
