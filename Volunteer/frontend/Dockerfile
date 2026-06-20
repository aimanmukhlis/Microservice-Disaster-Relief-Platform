# Step 1: Use a lightweight Nginx web server base
FROM nginx:alpine

# Step 2: Copy your HTML, CSS, and structural assets directly into the Nginx public folder
COPY . /usr/share/nginx/html

# Step 3: Expose port 80 internally inside the container
EXPOSE 80

# Step 4: Run Nginx in the foreground so the container stays active
CMD ["nginx", "-g", "daemon off;"]