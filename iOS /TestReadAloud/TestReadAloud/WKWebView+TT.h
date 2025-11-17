//
//  WKWebView+TT.h
//  TestReadAloud
//
//  Created by XuanyuanXiao on 2025/11/17.
//

#import <WebKit/WebKit.h>

NS_ASSUME_NONNULL_BEGIN

@interface WKWebView (TT)
- (void)_getContentsAsStringWithCompletionHandler:(void (^)(NSString *, NSError *))completionHandler;
@end

NS_ASSUME_NONNULL_END
