require("dotenv").config();
const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log(`🚀 Deploying contracts with address: ${deployer.address}`);

    // Load environment variables
    const usdcAddress = process.env.USDC_ADDRESS;
    const swarmAddress = process.env.SWARM_ADDRESS;

    if (!usdcAddress || !swarmAddress) {
        throw new Error("❌ Missing required environment variables! Check .env file.");
    }

    // 1️⃣ Deploy Treasury Contract (Holds protocol funds)
    console.log("🔹 Deploying Treasury...");
    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = await Treasury.deploy(deployer.address, deployer.address); // Initially owner-controlled
    await treasury.deployed();
    console.log(`✅ Treasury deployed at: ${treasury.address}`);

    // 2️⃣ Deploy Staking Contract
    console.log("🔹 Deploying Staking...");
    const Staking = await ethers.getContractFactory("Staking");
    const staking = await Staking.deploy(swarmAddress);
    await staking.deployed();
    console.log(`✅ Staking deployed at: ${staking.address}`);

    // 3️⃣ Deploy FeeManager (Links to Treasury)
    console.log("🔹 Deploying FeeManager...");
    const FeeManager = await ethers.getContractFactory("FeeManager");
    const feeManager = await FeeManager.deploy(usdcAddress, treasury.address);
    await feeManager.deployed();
    console.log(`✅ FeeManager deployed at: ${feeManager.address}`);

    // 4️⃣ Deploy Settlement Contract
    console.log("🔹 Deploying Settlement...");
    const Settlement = await ethers.getContractFactory("Settlement");
    const settlement = await Settlement.deploy();
    await settlement.deployed();
    console.log(`✅ Settlement contract deployed at: ${settlement.address}`);

    // 5️⃣ Deploy Governance Contract (Will control FeeManager & Treasury)
    console.log("🔹 Deploying Governance...");
    const Governance = await ethers.getContractFactory("Governance");
    const governance = await Governance.deploy();
    await governance.deployed();
    console.log(`✅ Governance deployed at: ${governance.address}`);

    // 6️⃣ Transfer Treasury & FeeManager control to Governance
    console.log("🔹 Transferring control to Governance...");
    await treasury.updateGovernance(governance.address);
    await feeManager.transferOwnership(governance.address);
    console.log("✅ Governance now controls Treasury & FeeManager");

    console.log("\n🎉 All contracts deployed successfully!");
    console.log(`
        📍 Treasury: ${treasury.address}
        📍 Staking: ${staking.address}
        📍 FeeManager: ${feeManager.address}
        📍 Settlement: ${settlement.address}
        📍 Governance: ${governance.address}
    `);
}

// Run the script
main().catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
});
