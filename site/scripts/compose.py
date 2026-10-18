"""Turn a recorded webm into a captioned GIF + MP4.  Usage: python scripts/compose.py arena heist defense
Needs: pip install imageio-ffmpeg"""
import os, subprocess, sys
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
RAW, OUT = '../media/out/raw/', '../media/out/'
CAPTIONS = {
    'arena': 'Same scenario, four tool layers, one clock',
    'heist': 'A hijack, step by step',
    'defense': 'What each defense costs and buys',
}
FONT = r'C\:/Windows/Fonts/arialbd.ttf'

def graph(name):
    cap = CAPTIONS[name].replace("'", "")
    return ("color=c=0xE3D9C3:s=1080x800:r=30[bg];"
            "[0:v]scale=1000:-2,pad=iw+12:ih+12:6:6:color=0x1E1B16[a];"
            "[bg][a]overlay=(W-w)/2:14:shortest=1[b];"
            f"[b]drawtext=fontfile='{FONT}':text='{cap}':fontcolor=0x1E1B16:fontsize=34:x=(w-text_w)/2:y=h-50[v]")

def run(name):
    src = f'{RAW}{name}.webm'
    g = graph(name)
    mp4 = f'{OUT}toolgauntlet-{name}.mp4'
    subprocess.run([FF, '-y', '-i', src, '-filter_complex', g, '-map', '[v]', '-r', '30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                    '-crf', '24', '-preset', 'slow', '-movflags', '+faststart', mp4], check=True, capture_output=True)
    gif = f'{OUT}toolgauntlet-{name}.gif'
    for fps, w, colors in [(12, 900, 96), (10, 800, 64), (8, 720, 48)]:
        gg = (g + f";[v]fps={fps},scale={w}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors={colors}:stats_mode=diff[pal];"
              "[s1][pal]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle[gif]")
        subprocess.run([FF, '-y', '-i', src, '-filter_complex', gg, '-map', '[gif]', '-loop', '0', gif], check=True, capture_output=True)
        size = os.path.getsize(gif)
        print(f'{name}: gif {fps}fps {w}px {colors}c = {size/1e6:.2f} MB')
        if size <= 4.6e6:
            break
    print(f'{name}: mp4 = {os.path.getsize(mp4)/1e6:.2f} MB')

if __name__ == '__main__':
    for n in sys.argv[1:]:
        run(n)
