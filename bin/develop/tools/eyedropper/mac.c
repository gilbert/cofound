#include <node_api.h>
#include <ApplicationServices/ApplicationServices.h>
napi_value GetColor(napi_env env, napi_callback_info info) {
    CGPoint cursor = CGEventGetLocation(CGEventCreate(NULL));
    CGDirectDisplayID displayID = CGMainDisplayID();
    CGImageRef image = CGDisplayCreateImageForRect(
        displayID,
        CGRectMake(cursor.x, cursor.y, 1, 1)
    );
    CFDataRef data = CGDataProviderCopyData(CGImageGetDataProvider(image));
    const UInt8* buf = CFDataGetBytePtr(data);

    napi_value rgb;
    napi_create_array_with_length(env, 4, &rgb);

    napi_value r, g, b, wideGamut;
    napi_create_uint32(env, buf[2], &r);
    napi_create_uint32(env, buf[1], &g);
    napi_create_uint32(env, buf[0], &b);

    CGColorSpaceRef colorSpace = CGDisplayCopyColorSpace(displayID);
    bool isWideGamut = CGColorSpaceIsWideGamutRGB(colorSpace);
    napi_get_boolean(env, isWideGamut, &wideGamut);

    napi_set_element(env, rgb, 0, r);
    napi_set_element(env, rgb, 1, g);
    napi_set_element(env, rgb, 2, b);
    napi_set_element(env, rgb, 3, wideGamut);

    CFRelease(data);
    CGImageRelease(image);
    CGColorSpaceRelease(colorSpace);

    return rgb;
}

napi_value Init(napi_env env, napi_value exports) {
    napi_value fn;
    napi_create_function(env, NULL, 0, GetColor, NULL, &fn);
    return fn; // Export the function directly
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
