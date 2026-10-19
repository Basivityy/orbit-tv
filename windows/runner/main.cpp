#include <flutter/dart_project.h>
#include <flutter/flutter_view_controller.h>
#include <flutter_windows.h>
#include <windows.h>

#include <algorithm>

#include "flutter_window.h"
#include "utils.h"

int APIENTRY wWinMain(_In_ HINSTANCE instance, _In_opt_ HINSTANCE prev,
                      _In_ wchar_t *command_line, _In_ int show_command) {
  // Attach to console when present (e.g., 'flutter run') or create a
  // new console when running with a debugger.
  if (!::AttachConsole(ATTACH_PARENT_PROCESS) && ::IsDebuggerPresent()) {
    CreateAndAttachConsole();
  }

  // Initialize COM, so that it is available for use in the library and/or
  // plugins.
  ::CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);

  flutter::DartProject project(L"data");

  std::vector<std::string> command_line_arguments =
      GetCommandLineArguments();

  project.set_dart_entrypoint_arguments(std::move(command_line_arguments));

  FlutterWindow window(project);
  // Open centred on the primary screen: 1440x860 logical pixels, or smaller
  // when the screen is small.
  RECT work = {0, 0, 1366, 728};
  ::SystemParametersInfo(SPI_GETWORKAREA, 0, &work, 0);
  const HMONITOR primary =
      ::MonitorFromPoint(POINT{0, 0}, MONITOR_DEFAULTTOPRIMARY);
  const double scale = FlutterDesktopGetDpiForMonitor(primary) / 96.0;
  const int work_w = static_cast<int>((work.right - work.left) / scale);
  const int work_h = static_cast<int>((work.bottom - work.top) / scale);
  const int width = std::max(960, std::min(1440, work_w - 60));
  const int height = std::max(600, std::min(860, work_h - 60));
  const int left = static_cast<int>(work.left / scale) + std::max(0, (work_w - width) / 2);
  const int top = static_cast<int>(work.top / scale) + std::max(0, (work_h - height) / 2);
  Win32Window::Point origin(static_cast<unsigned int>(left),
                            static_cast<unsigned int>(top));
  Win32Window::Size size(static_cast<unsigned int>(width),
                         static_cast<unsigned int>(height));
  if (!window.Create(L"Orbit Player", origin, size)) {
    return EXIT_FAILURE;
  }
  window.SetQuitOnClose(true);

  ::MSG msg;
  while (::GetMessage(&msg, nullptr, 0, 0)) {
    ::TranslateMessage(&msg);
    ::DispatchMessage(&msg);
  }

  ::CoUninitialize();
  return EXIT_SUCCESS;
}
