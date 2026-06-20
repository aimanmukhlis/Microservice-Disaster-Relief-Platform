# Step 1: Use an official lightweight Nginx image
FROM nginx:alpine

# Step 2: Copy your static frontend files into the default Nginx public directory
COPY . /usr/share/nginx/html

# Step 3: Expose port 80 internally inside the container
EXPOSE 80

# Step 4: Run Nginx in the foreground so the container stays active
CMD ["nginx", "-g", "daemon off;"]