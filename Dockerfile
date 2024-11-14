# Use the official Deno image
FROM denoland/deno:alpine

# Set the working directory
WORKDIR /app

# Copy the Deno script into the container
COPY . .

# Set Deno to run in production mode
ENV DENO_ENV=production

# Allow Deno to access network and read/write files
#RUN deno cache --unstable --lock=lock.json your_script.ts

# Expose the port your app runs on (default Deno port is 8000)
EXPOSE 8000

# Command to run your script
CMD ["run", "--allow-net", "--allow-read", "--allow-write", "--unstable-kv", "--unstable-cron", "index.ts"]
