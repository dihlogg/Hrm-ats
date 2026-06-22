#Step 1: Build
# Sử dụng Node.js image chính thức làm base image
FROM node:18-alpine AS builder

# Thiết lập thư mục làm việc trong container
WORKDIR /app

# Sao chép các tệp package.json và package-lock.json (nếu có)
COPY package*.json ./

# Cài đặt các dependencies
RUN npm install

# Sao chép toàn bộ mã nguồn dự án
COPY . .

# Build ứng dụng NestJS
RUN npm run build


#Step 2: RUN
# Tạo image production
FROM node:18-alpine AS production

# Thiết lập thư mục làm việc
WORKDIR /app

# Sao chép các tệp cần thiết từ giai đoạn builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
# Dòng này copy file .env nếu có
COPY --from=builder /app/.env* ./ 

# Cài đặt dependencies chỉ dành cho production
RUN npm install --only=production

# Thiết lập biến môi trường (nếu cần)
ENV NODE_ENV=production

# Mở cổng mà ứng dụng NestJS sử dụng 
EXPOSE 3004

# Lệnh để chạy ứng dụng
CMD ["node", "dist/main"]
