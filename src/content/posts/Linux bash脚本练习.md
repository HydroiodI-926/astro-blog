---
title: Linux bash脚本练习
published: 2026-08-02
tags:
  - Linux
  - 语法笔记
category: 开发笔记
---
# 批量上传文件到HDFS
```bash
#!/bin/bash

LOCAL_SOURCE_DIR="/data/local_files"  # 本地源文件目录
HDFS_TARGET_DIR="/user/hadoop/batch_uploads"  # hdfs目标目录
FILE_FILTER="*.txt"  # 文件过滤模式


LOG_FILE="./hdfs_upload_$(date +%Y%m%d).log"  # 日志文件路径

echo "=== 批量上传开始于 $(date) ===" >> $LOG_FILE

if [ ! -d "LOCAL_SOURCE_DIR" ]; then
    echo "error: 本地目录 $LOCAL_SCOURCE_DIR 不存在！" | tee -a $LOG_FILE
    exit 1
fi

if ! hdfs dfs -test -d "$HDFS_TARGET_DIR"; then
    echo "HDFS目录 $HDFS_TARGET_DIR 不存在，正在创建..." | tee -a $LOG_FILE
    hdfs dfs -mkdir -p "$HDFS_TARGET_DIR";
    if [ $? -ne 0 ]; then
        echo "error: Failed to create HDFS directory." | tee -a $LOG_FILE
        exit 1
    fi
fi

echo "开始上传文件（过滤条件：$FILE_FILTER）..." | tee -a $LOG_FILE

file_count=0
success_count=0
fail_count=0

for local_file in "$LOCAL_SCOURCE_DIR"/$FILE_FILTER; do
    if [ -f "$local_file" ]; then
        ((file_count++))

        filename=$(base "local_file")
        echo "正在上传：$filename" | tee -a $LOG_FILE

        hdfs dfs -put "$local_file" "$HDFS_TARGET_DIR/$filename"

        if [ $? -eq 0 ]; then
            ((success_count++))
            echo "Success: ${filename} uploaded succesfully" | tee -a $LOG_FILE
        else
            ((fail_count++))
            echo "Failure: Failed to upload ${filename}" | tee -a $LOG_FILE
        fi    
    fi
done

echo "=== 批量上传结束于 $(date) ===" | tee -a $LOG_FILE
## ${变量名}  $(命令)
echo "Total files: ${file_count}, succeed: ${success_count},failed: $fail_count" | tee -a $LOG_FILE
echo "HDFS target directory: $(hdfs dfs -ls ${HDFS_TARGET_DIR})" | tee -a $LOG_FILE
echo "Log file: ${LOG_FILE}" | tee -a $LOG_FILE
```
# 批量下载文件到HDFS
```bash
#!/bin/bash


HDFS_SOURCE_DIR="/root/hadoop/batch_uploads"
LOCAL_TARGET_DIR="/data/downloaded_files"
LOG_FILE="./hdfs_download_$(date +%Y%m%d).log"

echo "=== Batch download started at $(date) ===" >> $LOG_FILE

mkdir -p "$LOCAL_TARGET_DIR"

if [ $? -ne 0 ]; then
    echo "error: failed to create local directory: ${LOCAL_TARGET_DOR}" | tee -a $LOG_FILE
    exit 1
fi

if ! hdfs dfs -test -d "$HDFS_SOURCE_DIR"; then
    echo "error: HDFS directory does not exist: ${HDFS_SOURCE_DIR}" | tee -a $LOG_FILE
    exit 1
fi

echo "Downloading files..." | tee -a $LOG_FILE

file_count=0
success_count=0
fail_count=0
skip_count=0

while read hdfs_file; do
    filename=$(basename "$hdfs_file")
    local_file="$LOCAL_TARGET_DIR/$filename"

    if [ -f "local_file" ]; then
        ((skip_count++))
        echo "skipped: ${filename} already exists locally" | tee -a $LOG_FILE
        continue
    fi

    if [ -z "$hdfs_file" ];then
        ((skip_count++))
        echo "skipped: empty HDFS file detected: ${hdfs_file}" | tee -a $LOG_FILE
        continue
    fi
    ((file_count++))

    echo "downloading: ${filename}" | tee -a $LOG_FILE
    hdfs dfs -get "$hdfs_file" "$local_file"

    if [ $? -eq 0 ]; then
        ((success_count++))
        echo "Success: ${filename} downloaded successful" | tee -a $LOG_FILE
    else
        ((fail_count++))
        echo "Failure: ${filename} Failed to download" | tee -a $LOG_FILE
    fi
done < <(hdfs dfs -ls "$HDFS_SOURCE_DIR" | grep -v "^d" | awk '{print $8}')

echo "=== batch download ended at $(date) ===" | tee -a $LOG_FILE
echo "total: ${file_count},success: ${success_count},failure:${fail_count},skipped:${skip_count}" | tee -a $LOG_FILE
echo "log file: $LOG_FILE" | tee -a $LOG_FILE
```
# 批量清除HDFS中的文件
```bash
#!/bin/bash

HDFS_DIR="/user/root/batch_uploads"
RETENTION_DAYS=7
LOG_FILE="cleanup_log.txt"

echo "starting cleanup at $(date)" | tee -a $LOG_FILE

hdfs dfs -ls $HDFS_DIR | grep -v "^d" | awk -v days=$RETENTION_DAYS '{
    date_str = $6 " " $7
    file = $8

    "date -d \"" date_str "\" +%s" | getline cutoff_ts

    if(file_ts < cutoff_ts) {

        print "Delete old file: " file
        system("hdfs dfs -rm " file " >> '${LOG_FILE}' 2>&1)

    } 
}'

echo "Cleanup completed at $(date)" | tee -a $LOG_FILE
```
# 随机生成测试文件
```bash
#!/bin/bash

LOCAL_SOURCE_DIR="/data/local_files" 

if [ ! -d "$LOCAL_SOURCE_DIR" ]; then
    echo "warn: 本地目录 $LOCAL_SOURCE_DIR 不存在！"
    mkdir -p "LOCAL_SOURCE_DIR"
fi

echo "HDFS commend line test" > local_test.txt
mkdir -p local_data
for i in {1..5};do
    echo "Test file $i" > "${LOCAL_SOURCE_DIR}/file${i}.txt";
done
```
