# RISC-V Development Environment Setup and Usage Guide

## 1\. Windows Subsystem for Linux (WSL)

To begin, ensure you have **Windows Subsystem for Linux (WSL)** installed on your Windows machine. WSL allows you to run a GNU/Linux environment directly on Windows, which is essential for this setup. For detailed installation instructions, including how to install Ubuntu on WSL, refer to the official Microsoft documentation: [Install Ubuntu on WSL](https://learn.microsoft.com/en-us/windows/wsl/).

-----

## 2\. Set Up Git

Git is crucial for cloning the necessary repositories. If you haven't already, set up Git within your WSL environment. You can do this by running:

```bash
sudo apt update
sudo apt install git
```

-----

## 3\. Set Up Libraries

Before installing the RISC-V simulator and toolchain, you need to install several development libraries and tools. Open your WSL terminal and execute the following commands:

```bash
sudo apt update
sudo apt install make autoconf automake autotools-dev curl python3 python3-pip libmpc-dev libmpfr-dev libgmp-dev gawk build-essential bison flex texinfo gperf libtool patchutils bc zlib1g-dev libexpat-dev ninja-build git cmake libglib2.0-dev libboost-all-dev g++-11
```

This command installs a comprehensive set of packages required for building compilers, simulators, and other related tools.

-----

## 4\. Installing VeeR-ISS

VeeR-ISS is an Instruction Set Simulator for RISC-V. Follow these steps to clone, configure, and build it:

1.  **Clone the Repository:**

    ```bash
    cd ~
    git clone https://github.com/chipsalliance/VeeR-ISS.git
    cd VeeR-ISS
    ```

2.  **Modify GNUmakefile:**
    Open the `GNUmakefile` file located in the `VeeR-ISS` directory using a text editor (e.g., `nano` or `vim`).

    Locate the commented lines for `CC`, `CXX`, and `AR`:

    ```makefile
    #CC := gcc-8
    #CXX := g++-8
    #AR := gcc-ar-8
    ```

    **Uncomment these lines and change the version from `8` to `11`**:

    ```makefile
    CC := gcc-11
    CXX := g++-11
    AR := gcc-ar-11
    ```

    Save and close the file.

3.  **Build VeeR-ISS:**

    ```bash
    make SOFT_FLOAT=1
    ```

    This command compiles the simulator.

4.  **Verify Installation:**
    Once the build process completes, navigate to the `build-Linux` directory:

    ```bash
    cd build-Linux
    ```

    Run the `whisper` executable to confirm it's working:

    ```bash
    ./whisper
    ```

    You should see the output: `No program file specified.`

5.  **Add to PATH:**
    To make `whisper` accessible from any directory, add its location to your system's PATH environment variable.

    ```bash
    echo 'export PATH="$HOME/VeeR-ISS/build-Linux:$PATH"' >> ~/.bashrc
    source ~/.bashrc
    ```

    Now, you can run `whisper` from your home directory:

    ```bash
    cd ~
    whisper
    ```

    This should again output: `No program file specified.`

-----

## 5\. Install and Build the RISC-V Toolchain

The RISC-V GNU toolchain provides the necessary compilers, assemblers, and linkers to develop software for RISC-V architectures. The required packages for building the toolchain should have been installed in [Step 3](#3-set-up-libraries).

1.  **Clone the Toolchain Repository:**

    ```bash
    cd ~        # Ensure you are in your home directory
    git clone https://github.com/riscv-collab/riscv-gnu-toolchain
    cd riscv-gnu-toolchain
    ```

2.  **Initialize Submodules:**

    ```bash
    git submodule update --init --recursive
    ```

    It's completely normal for this command to take a while. So stop panicking. Take a coffee break. Touch grass, maybe.

    *Note*: You might encounter an error while running this command, similar to the following:

    ```bash
    error: Server does not allow request for unadvertised object 935a51f3c66ece357ce0d18f3aa3627a13cef7d5
    fatal: Fetched in submodule path 'dejagnu', but it did not contain 935a51f3c66ece357ce0d18f3aa3627a13cef7d5. Direct fetching of that commit failed.
    ```

    This happens because the repository tries to fetch a specific commit from the `dejagnu` submodule that no longer exists in the upstream repository. As a result, Git fails to complete the submodule update process.

    `dejagnu` is a testing framework used primarily for running regression tests on compiler toolchains. You will probably not need it unless you plan to run `make check` to validate the toolchain with test cases.

    So it's safe to remove it and proceed:

    ```bash
    
    git submodule deinit -f dejagnu
    git rm -f dejagnu
    rm -rf .git/modules/dejagnu
    rm -rf dejagnu
    git commit -m "Removed dejagnu"
    ```

    Then re-run the submodule initialization:

    ```bash
    git submodule update --init --recursive
    ```

    This will skip the broken submodule and allow the remaining components to be fetched and prepared correctly.

3.  **Configure and Build:**

    ```bash
    mkdir build
    ./configure --prefix=/opt/riscv32imfcv --with-arch=rv32imfcv --with-abi=ilp32f
    sudo make
    ```

      * `--prefix=/opt/riscv32imfcv`: Specifies the installation directory for the toolchain.
      * `--with-arch=rv32imfcv`: Configures the toolchain for the RV32IMFCV architecture (32-bit integer, multiply/divide, atomic, single-precision float, compressed, and vector extensions).
      * `--with-abi=ilp32f`: Sets the ABI (Application Binary Interface) to ILP32F.

4.  **Add to PATH:**
    Add the toolchain's binary directory to your system's PATH so you can easily invoke RISC-V specific commands.

    ```bash
    echo 'export PATH=/opt/riscv32imfcv/bin:$PATH' >> ~/.bashrc
    source ~/.bashrc
    ```

    To verify the installation, type `riscv32` in your terminal and press Tab for autocomplete. You should see a list of RISC-V commands (e.g., `riscv32-unknown-elf-gcc`).

-----

## 6\. Running RISC-V Code

This section describes how to compile and execute RISC-V code using this repository.

The repo has the following structure:

```
.
├── README.md
├── build.sh
├── count_vec.sh
├── sample.s
├── code_structure.md
└── veer
    ├── link.ld
    └── whisper.json
```

### Code Structure and Configuration

Before using the `build.sh` script, it's essential to understand the required code structure and the role of the configuration files within the `veer` directory:

  * **`veer/link.ld`**: This is the linker script. It defines how different sections of your compiled code (like `.text`, `.data`, etc.) are mapped into memory. This script is crucial for the linker to correctly arrange your program's components.
  * **`veer/whisper.json`**: This file contains configuration settings for the `whisper` simulator. It dictates various simulation parameters, such as memory layout, initial register values, and other hardware-specific settings.

For a detailed explanation of the required code structure for your RISC-V projects and how `link.ld` and `whisper.json` are used, please refer to [Code Structure](https://github.com/syedtaha22/riscv-env-setup/blob/main/code_structure.md). Understanding these files is necessary before successfully using the build script.

### `build.sh` Usage

The `build.sh` script is a utility for compiling and executing RISC-V assembly and C code.

To see the available options, run `build.sh` without any arguments:

```bash
./build.sh
```

This will display the help menu:

```
Usage: ./build.sh [options] <file> [<file> ...]

Options:
  -a             Compile and execute assembly (.s) files
  -c             Clean generated files
  -e             Execute the last compiled binary
  -g [opt_flag]  Compile C (.c) to assembly/object/hex with optional -O2/-O3
  -h             Show this help message
  -l <file>      Link additional assembly files

Examples:
  ./build.sh -a main.s -l conv2d.s
  ./build.sh -g -O3 main.c
```

**Key Flags:**

  * `-c`: Cleans up generated build files. Useful for starting with a fresh build.
  * `-a`: Compiles and executes the specified assembly (`.s`) file(s).
  * `-l <file>`: Used with `-a` to link additional assembly files, if your code is distributed across multiple files.

### Example: Compiling and Running Assembly

To compile and execute an assembly file named `sample.s`:

```bash
./build.sh -a sample.s
```

Upon execution, a `build/` folder will be generated with the following structure:

```
build/
├── asm
│   └── sample.s
├── dis
│   ├── sample.data
│   └── sample.dis
├── exe
│   └── sample.exe
├── hex
│   └── sample.hex
├── logs
│   └── sample.txt
└── obj
```

The most important file for execution analysis is `logs/sample.txt`.

### Analyzing `logs/sample.txt`

The `logs/sample.txt` file provides a detailed trace of the program's execution, including instruction execution, program counter values, and register states.

**Example Log Entry (Scalar Instruction):**

```
#11 0 8000011c b2868693 r 0d         f0040c40  addi     a3, a3, -1240
```

  * `#11`: Instruction number in the execution trace.
  * `8000011c`: Program Counter (PC) value at which the instruction was executed.
  * `b2868693`: The instruction in hexadecimal format.
  * `f0040c40`: The value written to the destination register (`a3`) after the instruction completes.
  * `addi a3, a3, -1240`: The disassembled instruction.

**Example Log Entry (Vector Instruction):**

```
#119 0 80000190 020f6087 v 01 0000000000000000000000000000000000000000000000000000000000000000 vle32.v v1, (t5)
```

  * `vle32.v v1, (t5)`: The disassembled vector instruction.
  * `0000000000000000000000000000000000000000000000000000000000000000`: This long sequence of zeroes represents the **value of the vector register `v1` after the instruction has been performed.** Each 8-digit segment within this sequence represents one 32-bit element of the vector.

Parsing this log file manually can be cumbersome. It is recommended to write a script to automate the parsing and analysis of `logs/sample.txt` for specific data.

-----

## 7\. Counting Vector Instructions

After you're done coding, you might need to get a list of the vector instructions you've used in your assembly files. This repo provides a script for that: `count_vec.sh`.

### `count_vec.sh` Usage

To view the usage instructions for the script, just run it without any arguments:

```bash
./count_vec.sh
```

This will output:

```
Usage: ./count_vec.sh [-d <directory> | -f <file>]

Counts RISC-V vector instructions (e.g., vadd, vle, etc.) in .s files.

Options:
  -d <directory>   Directory containing .s files to scan
  -f <file>        Single .s file to scan
  -h, --help       Show this help message

Examples:
  ./count_vec.sh -d riscv-output
  ./count_vec.sh -f riscv-output/main.s
```

**Examples:**

  * **Scan a directory for assembly files:**

    ```bash
    ./count_vec.sh -d build/asm
    ```

  * **Scan a single assembly file:**

    ```bash
    ./count_vec.sh -f build/asm/sample.s
    ```

### Sample Output

The script provides a summary of vector instructions found and their counts:

```
13 vsetvli
9 vfmv
7 vle32
6 vmv
5 vse32
2 vlse32
2 vfredosum
2 vfmul
2 vfmax
2 vfdiv
1 vlsseg2e32
1 vfredsum
1 vfredmax
1 vfmacc
1 vfadd
Total = 55
```

This output lists each unique vector instruction encountered and the number of times it appeared in the scanned assembly files. This is useful for analyzing the vectorization efficiency of your code.

-----

## 8\. Help

If you encounter any issues or require further assistance with this setup, feel free to contact me via email at **syetaha@gmail.com**.

-----

## Resources

- **Repository**: [syedtaha22/riscv-env-setup](https://github.com/syedtaha22/riscv-env-setup/)
- **VeeR-ISS Simulator**: [chipsalliance/VeeR-ISS](https://github.com/chipsalliance/VeeR-ISS)
- **RISC-V GNU Toolchain**: [riscv-collab/riscv-gnu-toolchain](https://github.com/riscv-collab/riscv-gnu-toolchain)
- **RISC-V Specification**: [RISC-V International](https://riscv.org/technical/specifications/)
- **Windows Subsystem for Linux**: [Microsoft WSL Documentation](https://learn.microsoft.com/en-us/windows/wsl/)