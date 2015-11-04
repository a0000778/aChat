CREATE TABLE `channel` (
  `channelId` smallint(5) unsigned NOT NULL AUTO_INCREMENT,
  `name` char(20) COLLATE utf8_unicode_ci NOT NULL,
  PRIMARY KEY (`channelId`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci COMMENT='頻道列表';

INSERT INTO `channel` (`name`) VALUES ("預設頻道");

CREATE TABLE `chatlog` (
  `messageId` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT '訊息編號',
  `time` datetime(3) NOT NULL COMMENT '發言時間',
  `fromUserId` int(10) unsigned DEFAULT NULL COMMENT '發言者id',
  `toUserId` int(10) unsigned DEFAULT NULL COMMENT '密頻目標id',
  `channelId` smallint(5) unsigned DEFAULT NULL COMMENT '頻道ID',
  `type` tinyint(1) unsigned NOT NULL DEFAULT '0' COMMENT '類型',
  `message` text(16383) COLLATE utf8_unicode_ci NOT NULL,
  PRIMARY KEY (`messageId`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci COMMENT='聊天室訊息';

CREATE TABLE `session` (
  `session` binary(20) NOT NULL,
  `userId` int(10) unsigned NOT NULL COMMENT '所屬userId',
  `messageId` int(11) NOT NULL COMMENT '最後取得訊息ID',
  `createTime` datetime(3) NOT NULL COMMENT '建立時間',
  `lastClient` varchar(150) DEFAULT NULL COMMENT '最後使用用戶端',
  `lastLogin` datetime(3) DEFAULT NULL COMMENT '最後登入時間',
  PRIMARY KEY (`session`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE `user` (
  `userId` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(20) COLLATE utf8_unicode_ci NOT NULL DEFAULT '',
  `password` binary(32) NOT NULL,
  `email` varchar(100) COLLATE utf8_unicode_ci NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '0',
  `regTime` datetime(3) NOT NULL,
  `actionGroup` varchar(20) COLLATE utf8_unicode_ci NOT NULL DEFAULT 'Normal',
  PRIMARY KEY (`userId`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;