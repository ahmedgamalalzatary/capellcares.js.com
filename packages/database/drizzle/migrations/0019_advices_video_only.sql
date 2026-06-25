ALTER TABLE `advices`
MODIFY COLUMN `video_url` varchar(1024) NOT NULL,
DROP COLUMN `image_path`;
