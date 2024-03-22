# Use an official Node.js runtime as the base image
FROM node:20

# Install GraphicsMagick
RUN apt-get update && \
    apt-get install -y graphicsmagick

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy the rest of the application code to the working directory
COPY . .

# Expose the port your app runs on
EXPOSE 8002

# Command to run your application
CMD ["npm", "run", "dev"]
