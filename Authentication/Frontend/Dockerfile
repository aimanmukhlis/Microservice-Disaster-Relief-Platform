# Step 1: Use a lightweight Nginx web server base image
FROM nginx:alpine

# Step 2: Copy your html, css, and frontend js assets into Nginx's public rendering root
COPY . /usr/share/nginx/html

# Step 3: Expose port 80 inside the container universe
EXPOSE 80

# Step 4: Keep Nginx running in the foreground to maintain container health state
CMD ["nginx", "-g", "daemon off;"]